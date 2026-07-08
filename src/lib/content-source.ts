export type CompanyContentSource = {
  id: string;
  name: string;
  /** DB flag: the company's content plan is supplied externally (client/trainer),
   *  so the writer's plan cards (كتابة) are skipped. */
  contentSupplied?: boolean | null;
};

export function isTrainerSuppliedContentCompany(company: CompanyContentSource | null | undefined): boolean {
  if (!company) return false;
  if (company.contentSupplied) return true;
  // Legacy fallback for rows created before the contentSupplied flag existed.
  return company.id === "c_training" || company.name.trim() === "التدريب";
}
