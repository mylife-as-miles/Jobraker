select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='job_listings'
  and column_name in ('salary_period','salary_currency')
order by column_name;
