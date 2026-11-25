CREATE TABLE `resume` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "resume_id_check" CHECK(id = 1)
);
