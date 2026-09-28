use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{constants::*, error::PfandError, state::Event};

/// After the event has ended, the deposits of everyone who did not show up
/// go to the beneficiary chosen when the event was created.
#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        mut,
        has_one = organizer @ PfandError::Unauthorized,
        has_one = mint,
        has_one = beneficiary,
    )]
    pub event: Box<Account<'info, Event>>,
    /// CHECK: only used as the owner of the beneficiary token account; checked via `has_one`.
    pub beneficiary: UncheckedAccount<'info>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = organizer,
        associated_token::mint = mint,
        associated_token::authority = beneficiary,
        associated_token::token_program = token_program,
    )]
    pub beneficiary_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = event,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_settle(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &mut ctx.accounts.event;
    require!(!event.settled, PfandError::AlreadySettled);
    require!(now >= event.ends_at, PfandError::EventNotEnded);

    let forfeited = ctx.accounts.vault.amount;
    if forfeited > 0 {
        let organizer_key = event.organizer;
        let id_bytes = event.event_id.to_le_bytes();
        let seeds: &[&[u8]] = &[EVENT_SEED, organizer_key.as_ref(), &id_bytes, &[event.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.beneficiary_token.to_account_info(),
                    authority: event.to_account_info(),
                },
                &[seeds],
            ),
            forfeited,
            ctx.accounts.mint.decimals,
        )?;
    }
    event.settled = true;

    emit!(Settled {
        event: event.key(),
        attended: event.checked_in,
        no_shows: event.registered - event.checked_in,
        forfeited,
    });
    Ok(())
}

#[event]
pub struct Settled {
    pub event: Pubkey,
    pub attended: u32,
    pub no_shows: u32,
    pub forfeited: u64,
}
