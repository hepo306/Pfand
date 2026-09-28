//! Devnet-only helper: a test euro stablecoin (pEUR) anyone can mint, so the
//! demo works without real EURC/USDC. Compiled out without `devnet-faucet`.
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::constants::*;

#[derive(Accounts)]
pub struct InitFaucet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [FAUCET_MINT_SEED],
        bump,
        mint::decimals = 6,
        mint::authority = faucet_mint,
        mint::token_program = token_program,
    )]
    pub faucet_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [FAUCET_MINT_SEED], bump)]
    pub faucet_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = faucet_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_token: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_faucet(ctx: Context<Faucet>) -> Result<()> {
    let bump = ctx.bumps.faucet_mint;
    let seeds: &[&[u8]] = &[FAUCET_MINT_SEED, &[bump]];
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.faucet_mint.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.faucet_mint.to_account_info(),
            },
            &[seeds],
        ),
        FAUCET_AMOUNT,
    )
}
