//! Pfand: refundable no-show deposits for free events.
//!
//! Attendees lock a small stablecoin deposit when they register. Checking in at
//! the door refunds it instantly. Deposits of people who never showed up go to
//! a beneficiary the organizer named up front (the club, or a charity).
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FhmtxMbGXWjhgMVXdEEoreMsuexdRirXg76T9RXjMQeb");

#[program]
pub mod pfand {
    use super::*;

    pub fn create_event(ctx: Context<CreateEvent>, args: CreateEventArgs) -> Result<()> {
        instructions::create_event::handle_create_event(ctx, args)
    }

    pub fn register(ctx: Context<Register>) -> Result<()> {
        instructions::register::handle_register(ctx)
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        instructions::check_in::handle_check_in(ctx)
    }

    pub fn cancel_registration(ctx: Context<CancelRegistration>) -> Result<()> {
        instructions::cancel_registration::handle_cancel_registration(ctx)
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handle_settle(ctx)
    }

    #[cfg(feature = "devnet-faucet")]
    pub fn init_faucet(_ctx: Context<InitFaucet>) -> Result<()> {
        Ok(())
    }

    #[cfg(feature = "devnet-faucet")]
    pub fn faucet(ctx: Context<Faucet>) -> Result<()> {
        instructions::faucet::handle_faucet(ctx)
    }
}
