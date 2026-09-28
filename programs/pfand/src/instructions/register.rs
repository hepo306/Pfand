use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::PfandError,
    state::{Event, Ticket, TicketStatus},
};

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(mut)]
    pub attendee: Signer<'info>,
    #[account(mut, has_one = mint)]
    pub event: Box<Account<'info, Event>>,
    #[account(
        init,
        payer = attendee,
        space = 8 + Ticket::INIT_SPACE,
        seeds = [TICKET_SEED, event.key().as_ref(), attendee.key().as_ref()],
        bump
    )]
    pub ticket: Box<Account<'info, Ticket>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = attendee,
        token::token_program = token_program,
    )]
    pub attendee_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = event,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register(ctx: Context<Register>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &mut ctx.accounts.event;
    require!(!event.settled, PfandError::AlreadySettled);
    require!(now < event.starts_at, PfandError::RegistrationClosed);
    require!(event.registered < event.capacity, PfandError::EventFull);

    // Lock the deposit in the event's vault.
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.attendee_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.attendee.to_account_info(),
            },
        ),
        event.deposit,
        ctx.accounts.mint.decimals,
    )?;

    event.registered += 1;

    let ticket = &mut ctx.accounts.ticket;
    ticket.event = event.key();
    ticket.attendee = ctx.accounts.attendee.key();
    ticket.status = TicketStatus::Registered;
    ticket.registered_at = now;
    ticket.checked_in_at = 0;
    ticket.bump = ctx.bumps.ticket;

    emit!(Registered {
        event: ticket.event,
        attendee: ticket.attendee,
        deposit: event.deposit,
    });
    Ok(())
}

#[event]
pub struct Registered {
    pub event: Pubkey,
    pub attendee: Pubkey,
    pub deposit: u64,
}
