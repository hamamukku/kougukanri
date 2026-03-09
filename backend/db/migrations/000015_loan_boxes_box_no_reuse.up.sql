ALTER TABLE loan_boxes
DROP CONSTRAINT IF EXISTS loan_boxes_borrower_id_box_no_key;

CREATE INDEX IF NOT EXISTS idx_loan_boxes_borrower_id_box_no
ON loan_boxes(borrower_id, box_no);
