//#region src/claude-managed-agents/v0/types.ts
function isUserMessageEvent(event) {
	return event.type === "user.message" && "content" in event && Array.isArray(event.content);
}
function isCustomToolUseEvent(value) {
	if (value === null || typeof value !== "object") return false;
	const event = value;
	return event.type === "agent.custom_tool_use" && typeof event.id === "string" && typeof event.name === "string" && typeof event.processed_at === "string" && event.input !== null && typeof event.input === "object";
}
/** Concatenate `user.message` text blocks for inbound rules. */
function inboundTextFromEvents(events) {
	const parts = [];
	for (const event of events) {
		if (!isUserMessageEvent(event)) continue;
		for (const block of event.content) if (block.type === "text" && "text" in block && typeof block.text === "string") parts.push(block.text);
	}
	return parts.join("\n");
}
//#endregion
export { inboundTextFromEvents, isCustomToolUseEvent, isUserMessageEvent };
