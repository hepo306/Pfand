use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::PfandError,
    state::{Event, Ticket, TicketStatus},
};

/// Signed by the organizer at the door after scanning the attendee's QR code.
/// Marks the ticket as attended and sends the deposit straight back.
#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        mut,
        has_one = organizer @ PfandError::Unauthorized,
        has_one = mint,
    )]
    pub event: Box<Account<'info, Event>>,
    #[account(
        mut,
        seeds = [TICKET_SEED, event.key().as_ref(), ticket.attendee.as_ref()],
        bump = ticket.bump,
        has_one = event,
    )]
    pub ticket: Box<Account<'info, Ticket>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = mint,
        constraint = attendee_token.owner == ticket.attendee @ PfandError::WrongAttendee,
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

pub fn handle_check_in(ctx: Context<CheckIn>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &mut ctx.accounts.event;
    let ticket = &mut ctx.accounts.ticket;
    require!(!event.settled, PfandError::AlreadySettled);
    require!(
        ticket.status == TicketStatus::Registered,
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

    ticket.status = TicketStatus::CheckedIn;
    ticket.checked_in_at = now;
    event.checked_in += 1;

    emit!(CheckedIn {
        event: event.key(),
        attendee: ticket.attendee,
        refunded: event.deposit,
    });
    Ok(())
}

#[event]
pub struct CheckedIn {
    pub event: Pubkey,
    pub attendee: Pubkey,
    pub refunded: u64,
}
