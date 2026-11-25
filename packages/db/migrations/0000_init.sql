CREATE TABLE `contact_account` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`verified_at` text,
	`notified_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_account_email_unique` ON `contact_account` (`email`);--> statement-breakpoint
CREATE TABLE `contact_session` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`verified_at` text,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `contact_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_session_account` ON `contact_session` (`account_id`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	`account_id` text,
	`confirmed_at` text,
	`session_hash` text,
	`source` text DEFAULT 'form' NOT NULL,
	`subject` text,
	`message_id` text,
	`auth` text,
	FOREIGN KEY (`account_id`) REFERENCES `contact_account`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "message_source_check" CHECK(source IN ('form', 'email'))
);
--> statement-breakpoint
CREATE INDEX `message_created` ON `message` (`created_at`);--> statement-breakpoint
CREATE INDEX `message_account` ON `message` (`account_id`,`confirmed_at`);--> statement-breakpoint
CREATE INDEX `message_session` ON `message` (`session_hash`);--> statement-breakpoint
CREATE INDEX `message_source` ON `message` (`source`,`created_at`);--> statement-breakpoint
CREATE TABLE `message_reply` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`send_status` text NOT NULL,
	`send_id` text,
	`send_error` text,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "message_reply_send_status_check" CHECK(send_status IN ('pending', 'sent', 'failed', 'logged'))
);
--> statement-breakpoint
CREATE INDEX `message_reply_message` ON `message_reply` (`message_id`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`draft` integer DEFAULT 1 NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	`search_title` text DEFAULT '' NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	CONSTRAINT "post_draft_check" CHECK(draft IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `post_published` ON `post` (`draft`,`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_unique` ON `post` (`slug`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`headline` text,
	`location` text,
	`bio` text,
	`links` text,
	`updated_at` text NOT NULL,
	CONSTRAINT "profile_id_check" CHECK(id = 1)
);
--> statement-breakpoint
CREATE TABLE `verify_token` (
	`link_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`session_hash` text,
	`code_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`send_status` text DEFAULT 'pending' NOT NULL,
	`send_id` text,
	`send_error` text,
	FOREIGN KEY (`account_id`) REFERENCES `contact_account`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "verify_token_send_status_check" CHECK(send_status IN ('pending', 'sent', 'failed', 'logged'))
);
--> statement-breakpoint
CREATE INDEX `verify_token_account` ON `verify_token` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `verify_token_created` ON `verify_token` (`created_at`);