export const load = async ({ url }: any) => {
	const action = url.searchParams.get('action');
	const title = url.searchParams.get('title');
	const chatId = url.searchParams.get('chatId');
	const desc = url.searchParams.get('desc');

	return {
		action,
		title,
		chatId,
		desc,
		hasValidParams: !!(action && title && chatId)
	};
}; 