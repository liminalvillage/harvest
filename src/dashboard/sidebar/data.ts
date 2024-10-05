import HomeIcon from './icons/HomeIcon.svelte';
import StatusIcon from './icons/StatusIcon.svelte';
import GlobeIcon from './icons/GlobeIcon.svelte';
import CreditsIcon from './icons/CreditsIcon.svelte';
import ArchivesIcon from './icons/ArchivesIcon.svelte';
import SettingsIcon from './icons/SettingsIcon.svelte';
import DocumentationIcon from './icons/DocumentationIcon.svelte';
import RolesIcon from './icons/RolesIcon.svelte';



export const data = [
	{
		title: 'Home',
		icon: HomeIcon,
		link: '/'
	},
	{
		title: 'Kanban',
		icon: ArchivesIcon,
		link: '/admin/kanban'
	},
	{
		title: 'Schedule',
		icon: CreditsIcon,
		link: '/admin/schedule'
	},
	{
		title: 'Roles',
		icon: RolesIcon,
		link: '/admin/roles'
	},
	{
		title: 'Map',
		icon: GlobeIcon,
		link: '/admin/map'
	},
	{
		title: 'Tags',
		icon: SettingsIcon,
		link: '/admin/tags'
	}
	// {
	// 	title: 'Documentation',
	// 	icon: DocumentationIcon,
	// 	link: '/admin/documentation'
	// }
];
