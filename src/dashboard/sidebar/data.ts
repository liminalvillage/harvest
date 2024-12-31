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
import ShoppingIcon from './icons/ShoppingIcon.svelte';
import ChecklistIcon from './icons/ChecklistIcon.svelte';

export const data = [
	{
		title: 'Dashboard',
		icon: DashboardIcon,
		link: '/dashboard'
	},
	{
		title: 'Tasks',
		icon: ArchivesIcon,
		link: '/tasks'
	},
	{
		title: 'Schedule',
		icon: CreditsIcon,
		link: '/calendar'
	},
	{
		title: 'Roles',
		icon: RolesIcon,
		link: '/roles'
	},
	{
		title: 'Map',
		icon: GlobeIcon,
		link: '/map'
	},
	{
		title: 'Tags',
		icon: TagsIcon,
		link: '/tags'
	},
	{
		title: 'Offers & Requests',
		icon: OffersIcon,
		link: '/offers'
	},
	{
		title: 'Shopping List',
		icon: ShoppingIcon,
		link: '/shopping'
	},
	{
		title: 'Checklists',
		icon: ChecklistIcon,
		link: '/checklists'
	},
	{
		title: 'Status',
		icon: StatusIcon,
		link: '/status'
	}
	// {
	// 	title: 'Documentation',
	// 	icon: DocumentationIcon,
	// 	link: '/admin/documentation'
	// }
];
