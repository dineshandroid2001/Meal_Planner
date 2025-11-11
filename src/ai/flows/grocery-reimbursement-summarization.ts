'use server';
/**
 * @fileOverview This file contains a Genkit flow for summarizing and analyzing grocery reimbursement requests.
 *
 * - groceryReimbursementSummarization - A function that processes grocery receipts and payment screenshots to ensure alignment with expected meal expenses.
 * - GroceryReimbursementInput - The input type for the groceryReimbursementSummarization function.
 * - GroceryReimbursementOutput - The return type for the groceryReimbursementSummarization function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GroceryReimbursementInputSchema = z.object({
  receiptDataUri: z
    .string()
    .describe(
      "A photo of the grocery receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  paymentScreenshotDataUri: z
    .string()
    .describe(
      "A photo of the payment screenshot, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  expectedTotalAmount: z.number().describe('The expected total amount of the grocery expense.'),
  description: z.string().describe('A description of the groceries purchased.'),
});
export type GroceryReimbursementInput = z.infer<typeof GroceryReimbursementInputSchema>;

const GroceryReimbursementOutputSchema = z.object({
  summary: z.string().describe('A summary of the grocery reimbursement request.'),
  alignment: z
    .string()
    .describe(
      'An analysis of whether the receipt and payment align with the expected expenses, flagging any discrepancies.'
    ),
  flaggedDiscrepancies: z.string().describe('Description of any discrepancies identified.'),
});
export type GroceryReimbursementOutput = z.infer<typeof GroceryReimbursementOutputSchema>;

export async function groceryReimbursementSummarization(
  input: GroceryReimbursementInput
): Promise<GroceryReimbursementOutput> {
  return groceryReimbursementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'groceryReimbursementPrompt',
  input: {schema: GroceryReimbursementInputSchema},
  output: {schema: GroceryReimbursementOutputSchema},
  prompt: `You are an expert in analyzing financial transactions and receipts.

You will receive a grocery receipt image, a payment screenshot, the expected total amount, and a description of the groceries purchased. Your task is to summarize the reimbursement request, analyze the alignment between the receipt, payment, and expected expenses, and flag any discrepancies.

Analyze the following information:

Description: {{{description}}}
Receipt: {{media url=receiptDataUri}}
Payment Screenshot: {{media url=paymentScreenshotDataUri}}
Expected Total Amount: {{{expectedTotalAmount}}}

Generate a summary, determine the alignment, and describe any discrepancies found. Be specific and clear in your analysis.`,
});

const groceryReimbursementFlow = ai.defineFlow(
  {
    name: 'groceryReimbursementFlow',
    inputSchema: GroceryReimbursementInputSchema,
    outputSchema: GroceryReimbursementOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
