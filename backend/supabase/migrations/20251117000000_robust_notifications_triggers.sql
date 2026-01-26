-- Update notifications type check constraint to include new types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('interview','application','system','company','job_search','credit'));

-- Function to create notification on new application
CREATE OR REPLACE FUNCTION public.trigger_notification_on_application()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, company, priority)
  VALUES (
    NEW.user_id,
    'application',
    'Application Submitted',
    'You have successfully applied to ' || NEW.company || ' for the position of ' || NEW.job_title,
    NEW.company,
    'high'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new application
DROP TRIGGER IF EXISTS on_application_created ON public.applications;
CREATE TRIGGER on_application_created
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.trigger_notification_on_application();


-- Function to create notification on credit transaction
CREATE OR REPLACE FUNCTION public.trigger_notification_on_credit_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_message text;
BEGIN
  -- Determine title based on transaction type
  IF NEW.type = 'earned' THEN
    v_title := 'Credits Earned';
  ELSIF NEW.type = 'bonus' THEN
    v_title := 'Bonus Credits Received';
  ELSIF NEW.type = 'refunded' THEN
    v_title := 'Credits Refunded';
  ELSIF NEW.type = 'consumed' THEN
    v_title := 'Credits Used';
  ELSE
    v_title := 'Credit Update';
  END IF;

  -- Determine message
  IF NEW.description IS NOT NULL THEN
    v_message := NEW.description || ' (' || ABS(NEW.amount) || ' credits)';
  ELSE
    v_message := 'Your credit balance has changed by ' || NEW.amount;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, priority)
  VALUES (
    NEW.user_id,
    'credit',
    v_title,
    v_message,
    'medium'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for credit transaction
DROP TRIGGER IF EXISTS on_credit_transaction_created ON public.credit_transactions;
CREATE TRIGGER on_credit_transaction_created
AFTER INSERT ON public.credit_transactions
FOR EACH ROW EXECUTE FUNCTION public.trigger_notification_on_credit_transaction();
