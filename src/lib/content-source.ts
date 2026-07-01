export type CompanyContentSource = {
  id: string;
  name: string;
};

export function isTrainerSuppliedContentCompany(company: CompanyContentSource | null | undefined): boolean {
  return company?.id === "c_training" || company?.name.trim() === "التدريب";
}
