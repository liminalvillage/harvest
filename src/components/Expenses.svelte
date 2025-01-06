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

    const holosphere = getContext("holosphere") as HoloSphere;
    
    $: holonID = $ID;
    let expenses: Record<string, Expense> = {};
    let store: Record<string, any> = {};
    let selectedCurrency = "euro";
    let creditMatrix: number[][] = [];
    
    // Get unique currencies from expenses
    $: currencies = [...new Set(Object.values(expenses).map(e => e.currency))];
    
    $: users = Object.values(store)
    
    onMount(() => {
        ID.subscribe((value) => {
            holonID = value;
            subscribeToExpenses();
            subscribeToUsers();
        });
    });

    function subscribeToExpenses(): void {
        expenses = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "expenses",
                (newItem: any, key: string) => {
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
                    calculateCredits(selectedCurrency);
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
                (newUser, key) => {
                    if (newUser) {
                        store[key] = newUser;
                    } else {
                        delete store[key];
                        store = store;
                    }
                    users = Object.values(store);
                    calculateCredits(selectedCurrency);
                }
            );
        }
    }

    function calculateCredits(currency: string): void {
        if (!currency || users.length === 0) return;
        
        currency = currency.toLowerCase().replace(/s$/, '').replace(/[^a-z]/g, '');
        
        creditMatrix = Array(users.length).fill(0).map(() => Array(users.length).fill(0));
        
        Object.values(expenses).forEach(expense => {
            console.log(expense);
            if (expense.currency.toLowerCase() === currency.toLowerCase()) {
                const amountPerPerson = expense.amount / (expense.splitWith.length || 1);
                const payerIndex = users.findIndex(user => user.id === expense.paidBy);
                
                expense.splitWith.forEach(member => {
                    const memberIndex = users.findIndex(user => user.id === member);
                    if (memberIndex === -1 || payerIndex === -1) return;
                    
                    if (payerIndex !== memberIndex) {
                        creditMatrix[payerIndex][memberIndex] += amountPerPerson;
                        creditMatrix[memberIndex][payerIndex] -= amountPerPerson;
                    }
                });
            }
        });
    }

    $: {
        if (selectedCurrency) {
            calculateCredits(selectedCurrency);
        }
    }

    function formatAmount(amount: number): string {
        if (['EUR','USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].includes(selectedCurrency.toUpperCase())) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: selectedCurrency.toUpperCase()
            }).format(Math.abs(amount));
        } else {
            return Math.abs(amount).toFixed(2);
        }
    }
</script>

<div class="w-full bg-gray-800 p-6 rounded-3xl">
    <div class="flex justify-between text-white items-center mb-8">
        <p class="text-2xl font-bold">Expenses</p>
        <select
            bind:value={selectedCurrency}
            class="bg-gray-700 text-white px-4 py-2 rounded-lg"
        >
            {#each currencies as currency}
                <option value={currency}>{currency.toUpperCase()}</option>
            {/each}
        </select>
    </div>

    <!-- Credits Table -->
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

    <!-- Recent Expenses -->
    <div class="mt-8">
        <h3 class="text-xl font-bold text-white mb-4">Recent Expenses</h3>
        <div class="space-y-4">
            {#each Object.values(expenses).filter(e => e.currency === selectedCurrency).sort((a, b) => new Date(parseInt(b.date)).getTime() - new Date(parseInt(a.date)).getTime()) as expense}
                <div class="bg-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-semibold text-white">{expense.description}</h4>
                            <p class="text-gray-300">Paid by {users.find(user => user.id === parseInt(expense.paidBy))?.first_name || expense.paidBy}</p>
                            <p class="text-sm text-gray-400">Split with: {expense.splitWith.map(id => users.find(user => user.id === parseInt(id))?.first_name || id).join(', ')}</p>
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
</div> 