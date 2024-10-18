import HomeIcon from './icons/HomeIcon.svelte';
import StatusIcon from './icons/StatusIcon.svelte';
import GlobeIcon from './icons/MapIcon.svelte';
import CreditsIcon from './icons/CreditsIcon.svelte';
import ArchivesIcon from './icons/ArchivesIcon.svelte';
import TagsIcon from './icons/TagsIcon.svelte';
import SettingsIcon from './icons/SettingsIcon.svelte';
import DocumentationIcon from './icons/DocumentationIcon.svelte';
import RolesIcon from './icons/RolesIcon.svelte';
import OffersIcon from './icons/OffersIcon.svelte'; // Add this import
import DashboardIcon from './icons/DashboardIcon.svelte';
import ShoppingListIcon from './icons/ShoppingListIcon.svelte';

export const data = [
	{
		title: 'Dashboard',
		icon: DashboardIcon,
		link: '/holon/dashboard'
	},
	{
		title: 'Kanban',
		icon: ArchivesIcon,
		link: '/holon/kanban'
	},
	{
		title: 'Schedule',
		icon: CreditsIcon,
		link: '/holon/schedule'
	},
	{
		title: 'Roles',
		icon: RolesIcon,
		link: '/holon/roles'
	},
	{
		title: 'Map',
		icon: GlobeIcon,
		link: '/holon/map'
	},
	{
		title: 'Tags',
		icon: TagsIcon,
		link: '/holon/tags'
	},
	{
		title: 'Offers',
		icon: OffersIcon,
		link: '/holon/offers'
	},
	{
	title: 'Shopping List',
	icon: ShoppingListIcon,
	link: '/holon/shopping'
	}
	// {
	// 	title: 'Documentation',
	// 	icon: DocumentationIcon,
	// 	link: '/admin/documentation'
	// }
];
