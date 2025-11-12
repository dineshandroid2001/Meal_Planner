// This is a whitelist of email addresses that are allowed to access the application.
// Add or remove emails from this list to manage access.
// Note: Emails are case-insensitive.

export const allowedEmails: string[] = [
  'admin@example.com',
  'user1@example.com',
  'user2@example.com',
  'dinesh0392001@gmail.com', // Example user
];

// Function to check if an email is in the whitelist (case-insensitive)
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return allowedEmails.some(
    (allowedEmail) => allowedEmail.toLowerCase() === email.toLowerCase()
  );
}
