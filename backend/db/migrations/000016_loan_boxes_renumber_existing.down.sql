DO $$
BEGIN
    RAISE EXCEPTION '000016_loan_boxes_renumber_existing is irreversible';
END
$$;
