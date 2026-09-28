use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{constants::*, error::PfandError, state::Event};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateEventArgs {
    pub event_id: u64,
    pub title: String,
    pub deposit: u64,
    pub capacity: u32,
    pub cancel_until: i64,
    pub starts_at: i64,
    pub ends_at: i64,
    pub beneficiary: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: CreateEventArgs)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Event::INIT_SPACE,
        seeds = [EVENT_SEED, organizer.key().as_ref(), &args.event_id.to_le_bytes()],
        bump
    )]
    pub event: Box<Account<'info, Event>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    /// Holds all deposits for this event. Owned by the event PDA, so only the
    /// program's rules can move the money.
    #[account(
        init,
        payer = organizer,
        associated_token::mint = mint,
        associated_token::authority = event,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_event(ctx: Context<CreateEvent>, args: CreateEventArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        !args.title.is_empty() && args.title.len() <= MAX_TITLE_LEN,
        PfandError::InvalidTitle
    );
    require!(args.deposit > 0, PfandError::InvalidDeposit);
    require!(args.capacity > 0, PfandError::InvalidCapacity);
    require!(
        now < args.cancel_until && args.cancel_until <= args.starts_at && args.starts_at < args.ends_at,
        PfandError::InvalidSchedule
    );

    let event = &mut ctx.accounts.event;
    event.organizer = ctx.accounts.organizer.key();
    event.event_id = args.event_id;
    event.title = args.title;
    event.mint = ctx.accounts.mint.key();
    event.deposit = args.deposit;
    event.capacity = args.capacity;
    event.registered = 0;
    event.checked_in = 0;
    event.cancel_until = args.cancel_until;
    event.starts_at = args.starts_at;
    event.ends_at = args.ends_at;
    event.beneficiary = args.beneficiary;
    event.settled = false;
    event.bump = ctx.bumps.event;

    emit!(EventCreated {
        event: event.key(),
        organizer: event.organizer,
        deposit: event.deposit,
        capacity: event.capacity,
    });
    Ok(())
}

#[event]
pub struct EventCreated {
    pub event: Pubkey,
    pub organizer: Pubkey,
    pub deposit: u64,
    pub capacity: u32,
}
