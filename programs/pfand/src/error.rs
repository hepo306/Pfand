use anchor_lang::prelude::*;

#[error_code]
pub enum PfandError {
    #[msg("Title must be 1-64 bytes")]
    InvalidTitle,
    #[msg("Deposit must be greater than zero")]
    InvalidDeposit,
    #[msg("Capacity must be greater than zero")]
    InvalidCapacity,
    #[msg("Times must satisfy: now < cancel_until <= starts_at < ends_at")]
    InvalidSchedule,
    #[msg("This event is full")]
    EventFull,
    #[msg("Registration is closed because the event has already started")]
    RegistrationClosed,
    #[msg("The cancellation deadline has passed")]
    CancellationClosed,
    #[msg("This ticket has already been checked in")]
    AlreadyCheckedIn,
    #[msg("The event has already been settled")]
    AlreadySettled,
    #[msg("The event has not ended yet")]
    EventNotEnded,
    #[msg("Only the organizer can do this")]
    Unauthorized,
    #[msg("Account does not match the ticket holder")]
    WrongAttendee,
    #[msg("Contact details must be 1-256 bytes")]
    InvalidContact,
}
