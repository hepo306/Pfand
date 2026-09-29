/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pfand.json`.
 */
export type Pfand = {
  "address": "FhmtxMbGXWjhgMVXdEEoreMsuexdRirXg76T9RXjMQeb",
  "metadata": {
    "name": "pfand",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Pfand: refundable no-show deposits for free events, on Solana"
  },
  "instructions": [
    {
      "name": "cancelRegistration",
      "discriminator": [
        238,
        114,
        1,
        94,
        90,
        159,
        183,
        53
      ],
      "accounts": [
        {
          "name": "attendee",
          "writable": true,
          "signer": true,
          "relations": [
            "ticket"
          ]
        },
        {
          "name": "event",
          "writable": true,
          "relations": [
            "ticket"
          ]
        },
        {
          "name": "ticket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "attendee"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "event"
          ]
        },
        {
          "name": "attendeeToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "checkIn",
      "discriminator": [
        209,
        253,
        4,
        217,
        250,
        241,
        207,
        50
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true,
          "relations": [
            "event"
          ]
        },
        {
          "name": "event",
          "writable": true,
          "relations": [
            "ticket"
          ]
        },
        {
          "name": "ticket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "ticket.attendee",
                "account": "ticket"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "event"
          ]
        },
        {
          "name": "attendeeToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createEvent",
      "discriminator": [
        49,
        219,
        29,
        203,
        22,
        98,
        100,
        87
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "event",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  118,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "organizer"
              },
              {
                "kind": "arg",
                "path": "args.eventId"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "docs": [
            "Holds all deposits for this event. Owned by the event PDA, so only the",
            "program's rules can move the money."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createEventArgs"
            }
          }
        }
      ]
    },
    {
      "name": "faucet",
      "discriminator": [
        0,
        98,
        59,
        30,
        144,
        142,
        113,
        12
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "faucetMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  101,
                  115,
                  116,
                  45,
                  101,
                  117,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "userToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "faucetMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initFaucet",
      "discriminator": [
        122,
        64,
        137,
        151,
        7,
        139,
        100,
        57
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "faucetMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  101,
                  115,
                  116,
                  45,
                  101,
                  117,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "register",
      "discriminator": [
        211,
        124,
        67,
        15,
        211,
        194,
        178,
        240
      ],
      "accounts": [
        {
          "name": "attendee",
          "writable": true,
          "signer": true
        },
        {
          "name": "event",
          "writable": true
        },
        {
          "name": "ticket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "attendee"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "event"
          ]
        },
        {
          "name": "attendeeToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "contact",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "settle",
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true,
          "relations": [
            "event"
          ]
        },
        {
          "name": "event",
          "writable": true
        },
        {
          "name": "beneficiary",
          "relations": [
            "event"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "event"
          ]
        },
        {
          "name": "beneficiaryToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "beneficiary"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "event",
      "discriminator": [
        125,
        192,
        125,
        158,
        9,
        115,
        152,
        233
      ]
    },
    {
      "name": "ticket",
      "discriminator": [
        41,
        228,
        24,
        165,
        78,
        90,
        235,
        200
      ]
    }
  ],
  "events": [
    {
      "name": "cancelled",
      "discriminator": [
        136,
        23,
        42,
        65,
        143,
        233,
        234,
        46
      ]
    },
    {
      "name": "checkedIn",
      "discriminator": [
        211,
        80,
        198,
        244,
        196,
        84,
        212,
        150
      ]
    },
    {
      "name": "eventCreated",
      "discriminator": [
        59,
        186,
        199,
        175,
        242,
        25,
        238,
        94
      ]
    },
    {
      "name": "registered",
      "discriminator": [
        11,
        222,
        10,
        72,
        160,
        110,
        165,
        227
      ]
    },
    {
      "name": "settled",
      "discriminator": [
        232,
        210,
        40,
        17,
        142,
        124,
        145,
        238
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTitle",
      "msg": "Title must be 1-64 bytes"
    },
    {
      "code": 6001,
      "name": "invalidDeposit",
      "msg": "Deposit must be greater than zero"
    },
    {
      "code": 6002,
      "name": "invalidCapacity",
      "msg": "Capacity must be greater than zero"
    },
    {
      "code": 6003,
      "name": "invalidSchedule",
      "msg": "Times must satisfy: now < cancel_until <= starts_at < ends_at"
    },
    {
      "code": 6004,
      "name": "eventFull",
      "msg": "This event is full"
    },
    {
      "code": 6005,
      "name": "registrationClosed",
      "msg": "Registration is closed because the event has already started"
    },
    {
      "code": 6006,
      "name": "cancellationClosed",
      "msg": "The cancellation deadline has passed"
    },
    {
      "code": 6007,
      "name": "alreadyCheckedIn",
      "msg": "This ticket has already been checked in"
    },
    {
      "code": 6008,
      "name": "alreadySettled",
      "msg": "The event has already been settled"
    },
    {
      "code": 6009,
      "name": "eventNotEnded",
      "msg": "The event has not ended yet"
    },
    {
      "code": 6010,
      "name": "unauthorized",
      "msg": "Only the organizer can do this"
    },
    {
      "code": 6011,
      "name": "wrongAttendee",
      "msg": "Account does not match the ticket holder"
    },
    {
      "code": 6012,
      "name": "invalidContact",
      "msg": "Contact details must be 1-256 bytes"
    }
  ],
  "types": [
    {
      "name": "cancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "attendee",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "checkedIn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "attendee",
            "type": "pubkey"
          },
          {
            "name": "refunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createEventArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "eventId",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "cancelUntil",
            "type": "i64"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "guestKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "event",
      "docs": [
        "One event. Also the authority over the deposit vault."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "eventId",
            "docs": [
              "Random id chosen by the organizer's client, part of the PDA seeds."
            ],
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "mint",
            "docs": [
              "Stablecoin used for the deposit (EURC / USDC on mainnet, pEUR on devnet)."
            ],
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "docs": [
              "Deposit per attendee, in base units of `mint`."
            ],
            "type": "u64"
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "registered",
            "type": "u32"
          },
          {
            "name": "checkedIn",
            "type": "u32"
          },
          {
            "name": "cancelUntil",
            "docs": [
              "Attendees can cancel and get their deposit back until this time."
            ],
            "type": "i64"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "docs": [
              "After this time the organizer can settle: unclaimed deposits go to `beneficiary`."
            ],
            "type": "i64"
          },
          {
            "name": "beneficiary",
            "docs": [
              "Wallet that receives no-show deposits (the club, or a charity)."
            ],
            "type": "pubkey"
          },
          {
            "name": "guestKey",
            "docs": [
              "X25519 public key guests encrypt their name and email to. Only the",
              "organizer can derive the matching secret (from a wallet signature)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "settled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "eventCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "capacity",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "registered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "attendee",
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "settled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "attended",
            "type": "u32"
          },
          {
            "name": "noShows",
            "type": "u32"
          },
          {
            "name": "forfeited",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ticket",
      "docs": [
        "One attendee's registration for one event."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "attendee",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "ticketStatus"
              }
            }
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "checkedInAt",
            "type": "i64"
          },
          {
            "name": "contact",
            "docs": [
              "Name and email, encrypted to `Event::guest_key`. Public chain, private content."
            ],
            "type": "bytes"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ticketStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "registered"
          },
          {
            "name": "checkedIn"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "eventSeed",
      "type": "bytes",
      "value": "[101, 118, 101, 110, 116]"
    },
    {
      "name": "faucetMintSeed",
      "type": "bytes",
      "value": "[116, 101, 115, 116, 45, 101, 117, 114]"
    },
    {
      "name": "ticketSeed",
      "type": "bytes",
      "value": "[116, 105, 99, 107, 101, 116]"
    }
  ]
};
