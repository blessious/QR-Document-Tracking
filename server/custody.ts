type Actor = {
  role: "admin" | "office_head" | "staff" | "receiving";
  officeId: string;
};

export function canMutateDocument(actor: Actor, custodyOfficeId: string) {
  return actor.role === "admin" || actor.officeId === custodyOfficeId;
}

export function nextStatusAction(status: "in_process" | "on_hold" | "returned" | "completed") {
  const map = {
    in_process: "processed",
    on_hold: "held",
    returned: "returned",
    completed: "completed",
  } as const;
  return map[status];
}
