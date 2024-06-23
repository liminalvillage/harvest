import HomeIcon from './icons/HomeIcon.svelte';
import StatusIcon from './icons/StatusIcon.svelte';
import CreditsIcon from './icons/CreditsIcon.svelte';
import ArchivesIcon from './icons/ArchivesIcon.svelte';
import SettingsIcon from './icons/SettingsIcon.svelte';
import DocumentationIcon from './icons/DocumentationIcon.svelte';

export const data = [
	{
		title: 'Home',
		icon: HomeIcon,
		link: '/'
	},
	{
		title: 'Map',
		icon: StatusIcon,
		link: '/admin/map'
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
		icon: SettingsIcon,
		link: '/admin/roles'
	},
	{
		title: 'Documentation',
		icon: DocumentationIcon,
		link: '/admin/documentation'
	}
];
