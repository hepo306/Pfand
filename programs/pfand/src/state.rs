use anchor_lang::prelude::*;

/// One event. Also the authority over the deposit vault.
#[account]
#[derive(InitSpace)]
pub struct Event {
    pub organizer: Pubkey,
    /// Random id chosen by the organizer's client, part of the PDA seeds.
    pub event_id: u64,
    #[max_len(64)]
    pub title: String,
    /// Stablecoin used for the deposit (EURC / USDC on mainnet, pEUR on devnet).
    pub mint: Pubkey,
    /// Deposit per attendee, in base units of `mint`.
    pub deposit: u64,
    pub capacity: u32,
    pub registered: u32,
    pub checked_in: u32,
    /// Attendees can cancel and get their deposit back until this time.
    pub cancel_until: i64,
    pub starts_at: i64,
    /// After this time the organizer can settle: unclaimed deposits go to `beneficiary`.
    pub ends_at: i64,
    /// Wallet that receives no-show deposits (the club, or a charity).
    pub beneficiary: Pubkey,
    /// X25519 public key guests encrypt their name and email to. Only the
    /// organizer can derive the matching secret (from a wallet signature).
    pub guest_key: [u8; 32],
    pub settled: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum TicketStatus {
    Registered,
    CheckedIn,
}

/// One attendee's registration for one event.
#[account]
#[derive(InitSpace)]
pub struct Ticket {
    pub event: Pubkey,
    pub attendee: Pubkey,
    pub status: TicketStatus,
    pub registered_at: i64,
    pub checked_in_at: i64,
    /// Name and email, encrypted to `Event::guest_key`. Public chain, private content.
    #[max_len(256)]
    pub contact: Vec<u8>,
    pub bump: u8,
}
