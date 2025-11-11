import ReimbursementClient from "./reimbursement-client";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import { ReimbursementRequest } from "@/lib/types";

async function getReimbursements() {
  const { firestore } = initializeFirebase();
  const q = query(collection(firestore, "reimbursements"), orderBy("submittedAt", "desc"));
  const querySnapshot = await getDocs(q);
  const reimbursements = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    submittedAt: doc.data().submittedAt.toDate(),
  })) as ReimbursementRequest[];
  return reimbursements;
}

export default async function ReimbursementPage() {
    const reimbursements = await getReimbursements();

    return (
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
            <ReimbursementClient initialReimbursements={reimbursements} />
        </div>
    );
}

export const revalidate = 10;
