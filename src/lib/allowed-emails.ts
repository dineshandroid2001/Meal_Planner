// This is a whitelist of email addresses that are allowed to access the application.
// Add or remove emails from this list to manage access.
// Note: Emails are case-insensitive.

export const allowedEmails: string[] = [
  'dhanabalmorshal@gmail.com',
  'kumaresanvijay2002@gmail.com',
  'sridharan01234@gmail.com',
  'dinesh0392001@gmail.com',
  'gowthamankittusamy@gmail.com',
  'gopinathramesh65@gmail.com',
  'tkdharanesh@gmail.com',
  'balajivenkat1302@gmail.com',
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
