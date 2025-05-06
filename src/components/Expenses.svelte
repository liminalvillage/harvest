<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";

    interface Expense {
        id: string;
        amount: number;
        currency: string;
        description: string;
        paidBy: string;
        splitWith: string[];
        date: string;
    }

    interface User {
        id: number;
        first_name: string;
    }

    const holosphere = getContext("holosphere") as HoloSphere;
    
    $: holonID = $ID;
    let expenses: Record<string, Expense> = {};
    let store: Record<string, User> = {};
    let selectedCurrency: string = '';
    let availableCurrencies: string[] = [];
    let currenciesFromSettingsLoaded = false;
    let creditMatrix: number[][] = [];
    
    $: users = Object.values(store);
    
    onMount(() => {
        ID.subscribe((value) => {
            holonID = value;
            subscribeToExpenses();
            subscribeToUsers();
            subscribeToSettings();
        });
    });

    function subscribeToExpenses(): void {
        expenses = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "expenses",
                (newItem: any, key?: string) => {
                    if (key === undefined) return;
                    if (newItem) {
                        try {
                            const parsedExpense = typeof newItem === 'string' ? JSON.parse(newItem) : newItem;
                            expenses[key] = parsedExpense as Expense;
                        } catch (e) {
                            console.error('Failed to parse expense:', e);
                        }
                    } else {
                        delete expenses[key];
                    }
                    expenses = expenses;
                    if (!currenciesFromSettingsLoaded) {
                        deriveCurrenciesFromExpenses();
                    }
                }
            );
        }
    }

    function subscribeToUsers(): void {
        store = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "users",
                (newUser: any, key?: string) => {
                    if (key === undefined) return;
                    if (newUser) {
                        store[key] = newUser as User;
                    } else {
                        delete store[key];
                    }
                    store = store;
                    users = Object.values(store);
                    if (!currenciesFromSettingsLoaded) {
                        deriveCurrenciesFromExpenses();
                    }
                }
            );
        }
    }

    function subscribeToSettings(): void {
        availableCurrencies = [];
        if (holosphere && holonID) {
            holosphere.subscribe(
                holonID,
                "settings",
                (settingsData: any, key?: string) => {
                    if (settingsData && Array.isArray(settingsData.currencies)) {
                        availableCurrencies = settingsData.currencies.filter((c: unknown) => typeof c === 'string');
                    } else {
                        console.warn("Settings data does not contain a valid 'currencies' array:", settingsData);
                        availableCurrencies = [];
                    }
                    availableCurrencies = [...availableCurrencies];

                    if (settingsData && Array.isArray(settingsData.currencies) && availableCurrencies.length > 0) {
                        currenciesFromSettingsLoaded = true;
                    } else {
                        currenciesFromSettingsLoaded = false;
                        deriveCurrenciesFromExpenses();
                    }
                }
            );
        }
    }

    function calculateCredits(currency: string): void {
        if (!currency || users.length === 0) return;
        
        currency = currency.toLowerCase().replace(/s$/, '').replace(/[^a-z]/g, '');
        
        creditMatrix = Array(users.length).fill(0).map(() => Array(users.length).fill(0));
        
        Object.values(expenses).forEach(expense => {
            if (expense.currency.toLowerCase() === currency.toLowerCase()) {
                const amountPerPerson = expense.amount / (expense.splitWith.length || 1);
                const payerIndex = users.findIndex(user => user.id === parseInt(expense.paidBy));
                
                expense.splitWith.forEach(memberId => {
                    const memberIndex = users.findIndex(user => user.id === parseInt(memberId));
                    if (memberIndex === -1 || payerIndex === -1) return;
                    
                    if (payerIndex !== memberIndex) {
                        creditMatrix[payerIndex][memberIndex] += amountPerPerson;
                        creditMatrix[memberIndex][payerIndex] -= amountPerPerson;
                    }
                });
            }
        });
    }

    function deriveCurrenciesFromExpenses() {
        const derived = [...new Set(Object.values(expenses).map(e => e.currency))] 
                        .filter(c => typeof c === 'string' && c !== '');
        
        if (derived.length > 0) {
            availableCurrencies = derived;
        } else {
            availableCurrencies = []; 
        }
        availableCurrencies = [...availableCurrencies];
    }

    // Set initial currency reactively
    $: {
        if (selectedCurrency === '' && availableCurrencies.length > 0) {
            selectedCurrency = availableCurrencies[0];
        }
    }

    // Reactive block that depends on selectedCurrency and users
    $: {
        if (selectedCurrency !== '' && users.length > 0) {
            calculateCredits(selectedCurrency);
        }
    }

    function formatAmount(amount: number): string {
        const currencyCode = selectedCurrency ? selectedCurrency.toUpperCase() : '';
        if (['EUR','USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].includes(currencyCode)) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currencyCode
            }).format(Math.abs(amount));
        } else {
            return Math.abs(amount).toFixed(2);
        }
    }
</script>

<div class="w-full bg-gray-800 p-6 rounded-3xl">
    <div class="flex justify-between text-white items-center mb-8">
        <p class="text-2xl font-bold">Expenses</p>
        {#if selectedCurrency !== ''}
        <select
            bind:value={selectedCurrency}
            class="bg-gray-700 text-white px-4 py-2 rounded-lg"
        >
            {#each availableCurrencies as currency}
                <option value={currency}>{currency.toUpperCase()}</option>
            {/each}
        </select>
        {:else}
            <span class="text-gray-500">Loading currencies...</span>
        {/if}
    </div>

    <!-- Credits Table -->
    {#if selectedCurrency !== ''}
    <div class="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-700">
        <table class="w-full text-white border-collapse relative">
            <thead class="sticky top-0 z-20">
                <tr class="border-b border-gray-700">
                    <th class="sticky left-0 top-0 z-30 px-6 py-3 bg-gray-900 text-sm font-semibold uppercase tracking-wider">
                        <div class="flex flex-col items-center gap-1">
                            <span class="text-gray-400">Owes</span>
                            <span class="text-lg">↓</span>
                            <span class="text-gray-400">Is Owed</span>
                            <span class="text-lg">→</span>
                        </div>
                    </th>
                    {#each users as user}
                        <th class="sticky top-0 px-3 py-3 bg-gray-900 text-sm font-semibold uppercase tracking-wider h-32 relative">
                            <div class="absolute inset-0 flex items-center justify-center">
                                <div class="transform -rotate-90 whitespace-nowrap">{user.first_name}</div>
                            </div>
                        </th>
                    {/each}
                    <th class="sticky top-0 px-3 py-3 bg-gray-800 font-bold border-l border-gray-600 text-sm uppercase tracking-wider h-32 relative">
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="transform -rotate-90 whitespace-nowrap">Balance</div>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
                {#each users as user, rowIndex}
                    <tr class="bg-gray-800 hover:bg-gray-750 transition-colors duration-150 ease-in-out {rowIndex % 2 === 0 ? 'bg-opacity-50' : 'bg-opacity-25'}">
                        <th class="sticky left-0 z-10 px-6 py-4 text-left font-medium bg-gray-800 {rowIndex % 2 === 0 ? 'bg-opacity-50' : 'bg-opacity-25'} align-middle">{user.first_name}</th>
                        {#each creditMatrix[rowIndex] as credit, colIndex}
                            <td 
                                class="px-3 py-4 text-center font-medium whitespace-nowrap align-middle {credit > 0 ? 'text-green-400' : credit < 0 ? 'text-red-400' : 'text-gray-400'}"
                            >
                                {credit !== 0 ? formatAmount(credit) : '—'}
                            </td>
                        {/each}
                        <td 
                            class="px-3 py-4 text-center font-bold whitespace-nowrap bg-gray-800 border-l border-gray-600 align-middle {creditMatrix[rowIndex].reduce((sum, val) => sum + val, 0) > 0 ? 'text-green-400' : creditMatrix[rowIndex].reduce((sum, val) => sum + val, 0) < 0 ? 'text-red-400' : 'text-gray-400'}"
                        >
                            {formatAmount(creditMatrix[rowIndex].reduce((sum, val) => sum + val, 0))}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    {:else}
        <div class="text-center text-gray-500 py-10">Select a currency to view balances.</div>
    {/if}

    <!-- Recent Expenses -->
    {#if selectedCurrency !== ''}
    <div class="mt-8">
        <h3 class="text-xl font-bold text-white mb-4">Recent Expenses</h3>
        <div class="space-y-4">
            {#each Object.values(expenses).filter(e => selectedCurrency !== '' && e.currency === selectedCurrency).sort((a, b) => new Date(parseInt(b.date)).getTime() - new Date(parseInt(a.date)).getTime()) as expense}
                <div class="bg-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-semibold text-white">{expense.description}</h4>
                            <p class="text-gray-300">Paid by {users.find(user => user.id === parseInt(expense.paidBy))?.first_name || `ID: ${expense.paidBy}`}</p>
                            <p class="text-sm text-gray-400">Split with: {expense.splitWith.map(id => users.find(user => user.id === parseInt(id))?.first_name || `ID: ${id}`).join(', ')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-bold text-white">{formatAmount(expense.amount)}</p>
                            <p class="text-sm text-gray-400">
                                {new Date(parseInt(expense.date)).toLocaleDateString()}<br>{new Date(parseInt(expense.date)).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
    {/if}
</div> 