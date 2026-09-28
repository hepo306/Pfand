use anchor_lang::prelude::*;

#[constant]
pub const EVENT_SEED: &[u8] = b"event";

#[constant]
pub const TICKET_SEED: &[u8] = b"ticket";

#[constant]
pub const FAUCET_MINT_SEED: &[u8] = b"test-eur";

/// Max length of an event title in bytes.
pub const MAX_TITLE_LEN: usize = 64;

/// Amount the devnet faucet hands out per call: 20.00 pEUR (6 decimals).
pub const FAUCET_AMOUNT: u64 = 20_000_000;
