CREATE INDEX "role_dept_scopes_dept_idx" ON "role_dept_scopes" USING btree ("dept_id");--> statement-breakpoint
CREATE INDEX "role_menus_menu_idx" ON "role_menus" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "user_dept_scopes_dept_idx" ON "user_dept_scopes" USING btree ("dept_id");--> statement-breakpoint
CREATE INDEX "user_group_members_user_idx" ON "user_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_group_roles_role_idx" ON "user_group_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_menus_menu_idx" ON "user_menus" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "user_positions_position_idx" ON "user_positions" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_department_idx" ON "users" USING btree ("department_id");