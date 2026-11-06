-- Club acceptance rewards use the existing deduplicated GoraPointEvent ledger.
ALTER TYPE "GoraPointReason" ADD VALUE 'CLUB_ACCEPTED';
