<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import type HoloSphere from "holosphere";

    interface Expense {
        id: string;
        amount: number;
        currency: string;
        description: string;
        paidBy: string;
        splitWith: string[];
        created: string;
    }

    const holosphere = getContext("holosphere") as HoloSphere;
    
    $: holonID = $ID;
    let expenses: Record<string, Expense> = {};
    let users: string[] = [];
    let selectedCurrency = "usd";
    let creditMatrix: number[][] = [];
    
    // Get unique currencies from expenses
    $: currencies = [...new Set(Object.values(expenses).map(e => e.currency))];
    
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
                (newItem: string, key: string) => {
                    if (newItem) {
                        expenses[key] = JSON.parse(newItem);
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
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "users",
                (newItem: string) => {
                    if (newItem) {
                        const user = JSON.parse(newItem);
                        if (!users.includes(user.username)) {
                            users = [...users, user.username];
                        }
                    }
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
            if (expense.currency === currency) {
                const amountPerPerson = expense.amount / (expense.splitWith.length || 1);
                const payerIndex = users.indexOf(expense.paidBy);
                
                expense.splitWith.forEach(member => {
                    const memberIndex = users.indexOf(member);
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
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: selectedCurrency.toUpperCase()
        }).format(Math.abs(amount));
    }
</script>

<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
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
    <div class="overflow-x-auto">
        <table class="w-full text-white">
            <thead>
                <tr>
                    <th class="px-4 py-2 bg-gray-700">Owes ↓ / Is Owed →</th>
                    {#each users as user}
                        <th class="px-4 py-2 bg-gray-700">{user}</th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each users as user, rowIndex}
                    <tr>
                        <th class="px-4 py-2 bg-gray-700">{user}</th>
                        {#each creditMatrix[rowIndex] as credit, colIndex}
                            <td 
                                class="px-4 py-2 text-center {credit > 0 ? 'text-green-400' : credit < 0 ? 'text-red-400' : 'text-gray-400'}"
                            >
                                {credit !== 0 ? formatAmount(credit) : '-'}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- Recent Expenses -->
    <div class="mt-8">
        <h3 class="text-xl font-bold text-white mb-4">Recent Expenses</h3>
        <div class="space-y-4">
            {#each Object.values(expenses).filter(e => e.currency === selectedCurrency).sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()) as expense}
                <div class="bg-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-semibold text-white">{expense.description}</h4>
                            <p class="text-gray-300">Paid by {expense.paidBy}</p>
                            <p class="text-sm text-gray-400">Split with: {expense.splitWith.join(', ')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-bold text-white">{formatAmount(expense.amount)}</p>
                            <p class="text-sm text-gray-400">
                                {new Date(expense.created).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div> 