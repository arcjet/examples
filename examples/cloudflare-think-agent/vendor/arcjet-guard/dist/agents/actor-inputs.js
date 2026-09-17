//#region src/agents/actor-inputs.ts
/**
* Resolve optional `actor` / `inputs` from a vendor policy. Static values are
* returned as-is; functions are awaited with the adapter's native arguments.
* Omitted fields stay omitted so they are not sent as `undefined` under
* `exactOptionalPropertyTypes`.
*/
async function resolveActorInputs(policy, ...args) {
	const actor = policy.actor === void 0 ? void 0 : typeof policy.actor === "function" ? await policy.actor(...args) : policy.actor;
	const inputs = policy.inputs === void 0 ? void 0 : typeof policy.inputs === "function" ? await policy.inputs(...args) : policy.inputs;
	return {
		...actor !== void 0 && { actor },
		...inputs !== void 0 && { inputs }
	};
}
//#endregion
export { resolveActorInputs };
