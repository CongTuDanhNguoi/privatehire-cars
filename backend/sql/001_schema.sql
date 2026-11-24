-- PrivateHire Cars — MySQL 8 schema (Staff Portal + Customer app)
-- Charset utf8mb4 / utf8mb4_unicode_ci, InnoDB. All DATETIME values are stored in UTC.
-- Run via `npm run db:reset` (drops and recreates the database, then seeds it).

CREATE TABLE staff (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,      -- always stored trimmed + lowercase
  phone         VARCHAR(30)  NULL,
  home_address  VARCHAR(255) NULL,
  card_last4    CHAR(4)      NULL,                  -- never the full card number, never the CVV
  password_hash VARCHAR(100) NOT NULL,
  email_verified_at DATETIME NULL,                  -- NULL until the emailed one-time code is entered
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One active email-verification code per customer (6 digits, stored hashed).
CREATE TABLE email_verifications (
  customer_id  INT UNSIGNED PRIMARY KEY,
  code_hash    CHAR(64)     NOT NULL,               -- HMAC-SHA256 of the code, never the code itself
  expires_at   DATETIME     NOT NULL,
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0, -- wrong entries for this code
  last_sent_at DATETIME     NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Forgot password (SCRUM-65): one active 4-digit code per customer, then a one-time reset token.
-- Also created at startup (CREATE TABLE IF NOT EXISTS) for databases made before this table existed.
CREATE TABLE password_resets (
  customer_id      INT UNSIGNED PRIMARY KEY,
  code_hash        CHAR(64)     NOT NULL,           -- HMAC-SHA256 of the code
  expires_at       DATETIME     NOT NULL,
  attempts         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at     DATETIME     NOT NULL,
  token_hash       CHAR(64)     NULL,               -- set once the right code is entered
  token_expires_at DATETIME     NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref      VARCHAR(20)  NOT NULL UNIQUE,    -- e.g. PHC-24051
  customer_id      INT UNSIGNED NOT NULL,
  service_name     VARCHAR(60)  NOT NULL,           -- e.g. 'Airport Transfer'
  pickup_location  VARCHAR(255) NOT NULL,
  destination      VARCHAR(255) NOT NULL,
  journey_datetime DATETIME     NOT NULL,
  passenger_count  TINYINT UNSIGNED NOT NULL,
  vehicle_size     VARCHAR(40)  NOT NULL,           -- e.g. 'Seven-Seater'
  status           ENUM('SAVED','PAID') NOT NULL DEFAULT 'SAVED',
  fare_pence       INT UNSIGNED NULL,               -- total paid in pence, frozen at payment
  discount_pence   INT UNSIGNED NULL,               -- online discount in pence, frozen at payment
  notify_phone     VARCHAR(30)  NULL,
  payment_ref      VARCHAR(20)  NULL,               -- e.g. TXN-48213
  paid_at          DATETIME     NULL,               -- UTC
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enquiries (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,   -- displayed as ENQ-000001
  customer_id INT UNSIGNED NOT NULL,
  type        ENUM('GENERAL','TRIP') NOT NULL,
  booking_id  INT UNSIGNED NULL,                         -- required for TRIP, NULL for GENERAL (enforced in services)
  subject     VARCHAR(120)  NOT NULL,
  message     VARCHAR(2000) NOT NULL,
  status      ENUM('AWAITING','RESOLVED') NOT NULL DEFAULT 'AWAITING',
  contact_name  VARCHAR(100) NULL,                       -- SCRUM-95 form fields (NULL for older enquiries)
  contact_email VARCHAR(254) NULL,
  contact_phone VARCHAR(30)  NULL,
  category      VARCHAR(80)  NULL,
  trip_snapshot JSON         NULL,                       -- planned trip when there is no saved booking
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (booking_id)  REFERENCES bookings(id),
  INDEX idx_enquiries_status_created (status, created_at),
  INDEX idx_enquiries_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enquiry_responses (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enquiry_id        INT UNSIGNED NOT NULL,
  staff_id          INT UNSIGNED NOT NULL,
  client_request_id CHAR(36)     NOT NULL UNIQUE,     -- UUID generated by the frontend, prevents double sends
  subject           VARCHAR(150) NOT NULL,
  body              TEXT         NOT NULL,
  intended_to       VARCHAR(254) NOT NULL,            -- the customer's real email
  delivered_to      VARCHAR(254) NULL,                -- actual recipient (differs in test mode)
  provider          ENUM('EMAILJS','MOCK') NOT NULL,
  test_mode         BOOLEAN      NOT NULL,
  send_status       ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  attempt_count     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  error_message     VARCHAR(500) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at           DATETIME NULL,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
  FOREIGN KEY (staff_id)   REFERENCES staff(id),
  INDEX idx_responses_enquiry (enquiry_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enquiry_status_history (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enquiry_id  INT UNSIGNED NOT NULL,
  from_status ENUM('AWAITING','RESOLVED') NOT NULL,
  to_status   ENUM('AWAITING','RESOLVED') NOT NULL,
  changed_by  INT UNSIGNED NULL,                      -- staff_id; NULL when changed automatically
  reason      ENUM('MANUAL','AUTO_AFTER_RESPONSE') NOT NULL,
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
  FOREIGN KEY (changed_by) REFERENCES staff(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
  scope        ENUM('STAFF','CUSTOMER') NOT NULL,
  email        VARCHAR(254) NOT NULL,
  fail_count   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  PRIMARY KEY (scope, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
