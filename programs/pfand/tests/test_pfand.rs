//! End-to-end tests for the Pfand program, run against LiteSVM.
//! Build the program first (`anchor build`), then `cargo test`.

use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::associated_token::{self, get_associated_token_address},
    litesvm::LiteSVM,
    pfand::state::{Event, Ticket, TicketStatus},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const TOKEN_PROGRAM: Pubkey = anchor_spl::token::ID;
const DEPOSIT: u64 = 5_000_000; // 5.00 pEUR
const START: i64 = 1_800_000_000;

struct Env {
    svm: LiteSVM,
    mint: Pubkey,
}

fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/pfand.so"));
    svm.add_program(pfand::id(), bytes).unwrap();
    set_time(&mut svm, START - 10_000);

    let payer = funded(&mut svm);
    let mint = Pubkey::find_program_address(&[pfand::FAUCET_MINT_SEED], &pfand::id()).0;
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::InitFaucet {}.data(),
        pfand::accounts::InitFaucet {
            payer: payer.pubkey(),
            faucet_mint: mint,
            token_program: TOKEN_PROGRAM,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut svm, ix, &payer).unwrap();
    Env { svm, mint }
}

fn set_time(svm: &mut LiteSVM, ts: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = ts;
    svm.set_sysvar(&clock);
}

fn funded(svm: &mut LiteSVM) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    kp
}

fn send(svm: &mut LiteSVM, ix: Instruction, signer: &Keypair) -> Result<(), String> {
    svm.expire_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e.meta.logs))
}

fn token_balance(svm: &LiteSVM, owner: &Pubkey, mint: &Pubkey) -> u64 {
    let ata = get_associated_token_address(owner, mint);
    match svm.get_account(&ata) {
        Some(acc) if acc.data.len() >= 72 => u64::from_le_bytes(acc.data[64..72].try_into().unwrap()),
        _ => 0,
    }
}

fn faucet(env: &mut Env, user: &Keypair) {
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::Faucet {}.data(),
        pfand::accounts::Faucet {
            user: user.pubkey(),
            faucet_mint: env.mint,
            user_token: get_associated_token_address(&user.pubkey(), &env.mint),
            token_program: TOKEN_PROGRAM,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, user).unwrap();
}

fn event_pda(organizer: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[pfand::EVENT_SEED, organizer.as_ref(), &id.to_le_bytes()],
        &pfand::id(),
    )
    .0
}

fn ticket_pda(event: &Pubkey, attendee: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[pfand::TICKET_SEED, event.as_ref(), attendee.as_ref()], &pfand::id()).0
}

fn create_event(env: &mut Env, organizer: &Keypair, beneficiary: Pubkey, capacity: u32) -> Pubkey {
    let id = 42u64;
    let event = event_pda(&organizer.pubkey(), id);
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::CreateEvent {
            args: pfand::CreateEventArgs {
                event_id: id,
                title: "Goethe AI Talk #7".into(),
                deposit: DEPOSIT,
                capacity,
                cancel_until: START - 3600,
                starts_at: START,
                ends_at: START + 7200,
                beneficiary,
                guest_key: [7u8; 32],
            },
        }
        .data(),
        pfand::accounts::CreateEvent {
            organizer: organizer.pubkey(),
            event,
            mint: env.mint,
            vault: get_associated_token_address(&event, &env.mint),
            token_program: TOKEN_PROGRAM,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, organizer).unwrap();
    event
}

fn register(env: &mut Env, event: Pubkey, attendee: &Keypair) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::Register { contact: vec![1u8; 200] }.data(),
        pfand::accounts::Register {
            attendee: attendee.pubkey(),
            event,
            ticket: ticket_pda(&event, &attendee.pubkey()),
            mint: env.mint,
            attendee_token: get_associated_token_address(&attendee.pubkey(), &env.mint),
            vault: get_associated_token_address(&event, &env.mint),
            token_program: TOKEN_PROGRAM,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, attendee)
}

fn check_in(env: &mut Env, event: Pubkey, signer: &Keypair, attendee: &Pubkey) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::CheckIn {}.data(),
        pfand::accounts::CheckIn {
            organizer: signer.pubkey(),
            event,
            ticket: ticket_pda(&event, attendee),
            mint: env.mint,
            attendee_token: get_associated_token_address(attendee, &env.mint),
            vault: get_associated_token_address(&event, &env.mint),
            token_program: TOKEN_PROGRAM,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, signer)
}

fn cancel(env: &mut Env, event: Pubkey, attendee: &Keypair) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::CancelRegistration {}.data(),
        pfand::accounts::CancelRegistration {
            attendee: attendee.pubkey(),
            event,
            ticket: ticket_pda(&event, &attendee.pubkey()),
            mint: env.mint,
            attendee_token: get_associated_token_address(&attendee.pubkey(), &env.mint),
            vault: get_associated_token_address(&event, &env.mint),
            token_program: TOKEN_PROGRAM,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, attendee)
}

fn settle(env: &mut Env, event: Pubkey, organizer: &Keypair, beneficiary: Pubkey) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pfand::id(),
        &pfand::instruction::Settle {}.data(),
        pfand::accounts::Settle {
            organizer: organizer.pubkey(),
            event,
            beneficiary,
            mint: env.mint,
            beneficiary_token: get_associated_token_address(&beneficiary, &env.mint),
            vault: get_associated_token_address(&event, &env.mint),
            token_program: TOKEN_PROGRAM,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, organizer)
}

fn read_event(env: &Env, event: Pubkey) -> Event {
    let acc = env.svm.get_account(&event).unwrap();
    Event::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

fn read_ticket(env: &Env, event: Pubkey, attendee: &Pubkey) -> Option<Ticket> {
    let acc = env.svm.get_account(&ticket_pda(&event, attendee))?;
    if acc.data.is_empty() {
        return None;
    }
    Some(Ticket::try_deserialize(&mut acc.data.as_slice()).unwrap())
}

#[test]
fn full_event_lifecycle() {
    let mut env = setup();
    let organizer = funded(&mut env.svm);
    let charity = Keypair::new().pubkey();
    let event = create_event(&mut env, &organizer, charity, 10);

    // Four students sign up, each locks 5 pEUR.
    let students: Vec<Keypair> = (0..4).map(|_| funded(&mut env.svm)).collect();
    for s in &students {
        faucet(&mut env, s);
        register(&mut env, event, s).unwrap();
        assert_eq!(token_balance(&env.svm, &s.pubkey(), &env.mint), 15_000_000);
    }
    assert_eq!(token_balance(&env.svm, &event, &env.mint), 4 * DEPOSIT);
    assert_eq!(read_event(&env, event).registered, 4);

    // Student 3 cancels in time: refund + spot freed.
    cancel(&mut env, event, &students[3]).unwrap();
    assert_eq!(token_balance(&env.svm, &students[3].pubkey(), &env.mint), 20_000_000);
    assert!(read_ticket(&env, event, &students[3].pubkey()).is_none());
    assert_eq!(read_event(&env, event).registered, 3);

    // After the deadline, cancelling no longer works.
    set_time(&mut env.svm, START - 60);
    let err = cancel(&mut env, event, &students[2]).unwrap_err();
    assert!(err.contains("CancellationClosed"), "{err}");

    // Door opens: students 0 and 1 show up and are refunded instantly.
    set_time(&mut env.svm, START + 300);
    for s in &students[..2] {
        check_in(&mut env, event, &organizer, &s.pubkey()).unwrap();
        assert_eq!(token_balance(&env.svm, &s.pubkey(), &env.mint), 20_000_000);
        let t = read_ticket(&env, event, &s.pubkey()).unwrap();
        assert_eq!(t.status, TicketStatus::CheckedIn);
        assert_eq!(t.contact.len(), 200);
    }

    // Registration is closed once the event has started.
    let latecomer = funded(&mut env.svm);
    faucet(&mut env, &latecomer);
    let err = register(&mut env, event, &latecomer).unwrap_err();
    assert!(err.contains("RegistrationClosed"), "{err}");

    // Settling before the end is rejected, so late arrivals still get their money back.
    let err = settle(&mut env, event, &organizer, charity).unwrap_err();
    assert!(err.contains("EventNotEnded"), "{err}");

    // After the event: student 2 never came, their 5 pEUR go to the charity.
    set_time(&mut env.svm, START + 7200);
    settle(&mut env, event, &organizer, charity).unwrap();
    assert_eq!(token_balance(&env.svm, &charity, &env.mint), DEPOSIT);
    assert_eq!(token_balance(&env.svm, &event, &env.mint), 0);
    let e = read_event(&env, event);
    assert!(e.settled);
    assert_eq!((e.registered, e.checked_in), (3, 2));

    // Nothing can happen after settlement.
    let err = check_in(&mut env, event, &organizer, &students[2].pubkey()).unwrap_err();
    assert!(err.contains("AlreadySettled"), "{err}");
    let err = settle(&mut env, event, &organizer, charity).unwrap_err();
    assert!(err.contains("AlreadySettled"), "{err}");
}

#[test]
fn only_organizer_can_check_in_and_only_once() {
    let mut env = setup();
    let organizer = funded(&mut env.svm);
    let event = create_event(&mut env, &organizer, organizer.pubkey(), 10);
    let student = funded(&mut env.svm);
    faucet(&mut env, &student);
    register(&mut env, event, &student).unwrap();

    // A student cannot check themselves in.
    let err = check_in(&mut env, event, &student, &student.pubkey()).unwrap_err();
    assert!(err.contains("Unauthorized"), "{err}");

    check_in(&mut env, event, &organizer, &student.pubkey()).unwrap();
    let err = check_in(&mut env, event, &organizer, &student.pubkey()).unwrap_err();
    assert!(err.contains("AlreadyCheckedIn"), "{err}");

    // A checked-in attendee can't also cancel for a second refund.
    let err = cancel(&mut env, event, &student).unwrap_err();
    assert!(err.contains("AlreadyCheckedIn"), "{err}");
    assert_eq!(token_balance(&env.svm, &student.pubkey(), &env.mint), 20_000_000);
}

#[test]
fn capacity_is_enforced_and_double_registration_fails() {
    let mut env = setup();
    let organizer = funded(&mut env.svm);
    let event = create_event(&mut env, &organizer, organizer.pubkey(), 1);
    let a = funded(&mut env.svm);
    let b = funded(&mut env.svm);
    faucet(&mut env, &a);
    faucet(&mut env, &b);
    register(&mut env, event, &a).unwrap();
    assert!(register(&mut env, event, &a).is_err());
    let err = register(&mut env, event, &b).unwrap_err();
    assert!(err.contains("EventFull"), "{err}");
}

/// The web app filters accounts by these sizes (app/src/lib/pfand.ts).
#[test]
fn account_sizes_match_the_app() {
    use anchor_lang::Space;
    assert_eq!(8 + Event::INIT_SPACE, 258);
    assert_eq!(8 + Ticket::INIT_SPACE, 350);
}
