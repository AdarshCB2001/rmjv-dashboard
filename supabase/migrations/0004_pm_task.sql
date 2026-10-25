-- Link to the task created in the project management app when an order is confirmed.
alter table orders add column if not exists pm_task_id text;
