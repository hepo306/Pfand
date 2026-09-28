use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::PfandError,
    state::{Event, Ticket, TicketStatus},
};

/// Attendee cancels before the deadline: full refund, ticket closed, spot freed.
#[derive(Accounts)]
pub struct CancelRegistration<'info> {
    #[account(mut)]
    pub attendee: Signer<'info>,
    #[account(mut, has_one = mint)]
    pub event: Box<Account<'info, Event>>,
    #[account(
        mut,
        close = attendee,
        seeds = [TICKET_SEED, event.key().as_ref(), attendee.key().as_ref()],
        bump = ticket.bump,
        has_one = event,
        has_one = attendee @ PfandError::WrongAttendee,
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
}

pub fn handle_cancel_registration(ctx: Context<CancelRegistration>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &mut ctx.accounts.event;
    require!(!event.settled, PfandError::AlreadySettled);
    require!(now <= event.cancel_until, PfandError::CancellationClosed);
    require!(
        ctx.accounts.ticket.status == TicketStatus::Registered,
        PfandError::AlreadyCheckedIn
    );

    let organizer_key = event.organizer;
    let id_bytes = event.event_id.to_le_bytes();
    let seeds: &[&[u8]] = &[EVENT_SEED, organizer_key.as_ref(), &id_bytes, &[event.bump]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.attendee_token.to_account_info(),
                authority: event.to_account_info(),
            },
            &[seeds],
        ),
        event.deposit,
        ctx.accounts.mint.decimals,
    )?;

    event.registered -= 1;

    emit!(Cancelled {
        event: event.key(),
        attendee: ctx.accounts.attendee.key(),
    });
    Ok(())
}

#[event]
pub struct Cancelled {
    pub event: Pubkey,
    pub attendee: Pubkey,
}
