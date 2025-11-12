export const load = async ({ url }: any) => {
	const action = url.searchParams.get('action');
	const title = url.searchParams.get('title');
	const desc = url.searchParams.get('desc');
	const holonID = url.searchParams.get('holonID');
	const deckId = url.searchParams.get('deckId');
	const cardId = url.searchParams.get('cardId');

	return {
		action,
		title,
		desc,
		holonID,
		deckId,
		cardId,
		hasValidParams: !!(action && title && holonID)
	};
}; 