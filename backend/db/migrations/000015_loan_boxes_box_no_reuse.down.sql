DROP INDEX IF EXISTS idx_loan_boxes_borrower_id_box_no;

ALTER TABLE loan_boxes
ADD CONSTRAINT loan_boxes_borrower_id_box_no_key UNIQUE (borrower_id, box_no);
