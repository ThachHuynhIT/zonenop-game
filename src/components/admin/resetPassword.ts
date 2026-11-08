import { type PasswordRole, passwordProblem } from "@/components/auth/password";

/**
 * State of the admin "new password" field. The policy is the role the account ends up with (promoting = admin), as
 * be_game checks it. `problem` is shown while typing (null while the field is still empty, where the hint is enough);
 * `ready` gates the submit button and Enter.
 */
export function resetPasswordState(password: string, targetRole: PasswordRole, promote: boolean): { role: PasswordRole; problem: string | null; ready: boolean } {
  const role: PasswordRole = promote ? "admin" : targetRole;
  const problem = passwordProblem(password, role);
  return { role, problem: password === "" ? null : problem, ready: problem === null };
}
