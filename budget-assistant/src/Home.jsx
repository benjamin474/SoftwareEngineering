import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { jwtDecode } from 'jwt-decode';
import { calculateTotalsForRange } from './transactionUtils';
import { useNavigate } from 'react-router-dom';
import fetchGPTResponse from './Axios';
import TransactionCharts from './TransactionCharts';

import './Home.css';

function Home() {
    const [selectedDate, setSelectedDate] = useState(new Date()); // 預設為今天的日期
    const [startDate, setStartDate] = useState(new Date()); // 篩選的起始日期
    const [endDate, setEndDate] = useState(new Date()); // 篩選的結束日期
    const [amount, setAmount] = useState(''); // 金額
    const [description, setDescription] = useState(''); // 描述
    const [kind, setKind] = useState('');
    const [type, setType] = useState('expense'); // 交易類型，預設為支出
    const [transactions, setTransactions] = useState([]); // 所有交易紀錄
    const [filteredTransactions, setFilteredTransactions] = useState([]); // 選擇日期的交易紀錄
    const [queryRange, setQueryRange] = useState('day');
    const [editingTransactions, setEditingTransactions] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const sidebarRef = useRef(null);
    const navigate = useNavigate();



    // 從後端獲取交易資料
    useEffect(() => {
        const fetchTransactions = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token found. Please log in.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3001/transactions', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Error fetching transactions: ${response.statusText}`);
                }

                const data = await response.json();
                setTransactions(data);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            }
        };

        fetchTransactions();
    }, []);


    const resetTime = (date) => {
        const newDate = new Date(date);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    }

    useEffect(() => {
        if (Array.isArray(transactions)) {
            const filtered = transactions.filter(
                (transaction) => {
                    const transactionDate = resetTime(new Date(transaction.date));
                    return transactionDate >= resetTime(startDate) && transactionDate <= resetTime(endDate);
                }
            );
            setFilteredTransactions(filtered);
        } else {
            console.error('Transactions is not an array:', transactions);
        }
    }, [startDate, endDate, transactions]);

    // 新增交易處理
    const handleSubmit = async (e) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found. Please log in.');
            return;
        }

        const decodedToken = jwtDecode(token);
        const userId = decodedToken.userId; // Adjust this based on your token's structure



        const newTransaction = {
            user: userId, // Set the user ID
            date: selectedDate.toLocaleDateString(),
            amount: parseFloat(amount),
            description,
            type,
            //gpt classified-------------------------------------------------------------------
            kind: (type === 'expense') ? await fetchGPTResponse(description + "是食物, 日用品, 交通, 娛樂, 健康, 教育, 服飾, 居住, 通訊, 水電, 保險, 投資, 人情, 旅遊, 其他中的哪一類，返回前述最符合的一項，只能回答二或三個字") :
                await fetchGPTResponse(description + "是薪資、投資、副業、租金、補助、禮金、退款、其他中的哪一類，返回前述最符合的一項，只能回答二個字"),
            //如果要使用，在Axios.jsx加上你的金鑰.-------------------------------------------

        };



        try {
            const token = localStorage.getItem('token');
            console.log('Token:', token);
            // 透過API將交易儲存到後端資料庫
            const response = await fetch('http://localhost:3001/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // 添加 Authorization header
                },
                body: JSON.stringify(newTransaction),
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const savedTransaction = await response.json();

            // 更新狀態
            setTransactions([...transactions, savedTransaction]);

            // 清空表單
            setAmount('');
            setDescription('');
        } catch (error) {
            console.error(`Failed to save transaction: ${error.message}`);
        }
    };

    const handleEditTransaction = (transaction) => {
        setAmount(transaction.amount.toString());
        setDescription(transaction.description);
        setEditingTransactions(transaction._id);
    }


    // 刪除交易處理
    const handleDeleteTransaction = async (id) => {
        try {
            const response = await fetch(`http://localhost:3001/transactions/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // 添加 Authorization header
                },
            });

            if (response.ok) {
                // 更新狀態，移除刪除的交易
                setTransactions(transactions.filter(transaction => transaction._id !== id));
            } else {
                console.error(`Failed to delete transaction: ${await response.text()}`);
            }
        } catch (error) {
            console.error(`Error deleting transaction: ${error}`);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('../login');
        alert("Log out successfully.");
    }

    const handleAdd = () => {
        navigate('/add-transaction');
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleClickOutside = (event) => {
        if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
            setIsSidebarOpen(false);
        }
    };

    useEffect(() => {
        if (isSidebarOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    // 計算該天的總金額
    const { incomeTotal, expenseTotal, netTotal } = filteredTransactions.reduce((totals, transaction) => {
        if (transaction.type == 'income') {
            totals.incomeTotal += transaction.amount;
        }
        else if (transaction.type == 'expense') {
            totals.expenseTotal += transaction.amount;
        }
        totals.netTotal = totals.incomeTotal - totals.expenseTotal;
        return totals;
    }, { incomeTotal: 0, expenseTotal: 0, netTotal: 0 });

    return (

        <div style={{ maxHeight: '100vh', overflowY: 'auto', width: '100vw', padding: '20px' }}>
            {/* 篩選日期範圍的部分 */}
            {/* Hamburger Menu */}
            <button className="hamburger-menu" onClick={toggleSidebar}>
                &#9776; {/* Unicode for three horizontal lines */}
            </button>

            {/* Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
                <div className="sidebar-buttons">
                    <button onClick={handleAdd}>Add</button>
                    <button onClick={handleLogout}>Log Out</button>
                </div>
            </div>

            <div className="content">
                {/* 顯示圖表 */}
                <TransactionCharts transactions={filteredTransactions} />
                <br/>
                <h2>查詢範圍</h2>
                <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    dateFormat="yyyy/MM/dd"
                />
                <div><h1>To</h1></div>
                <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    dateFormat="yyyy/MM/dd"
                />

                {/* 顯示篩選後的交易紀錄 */}
                <h3>以下是您從 {startDate.toLocaleDateString()} 到 {endDate.toLocaleDateString()} 的帳務~</h3>
            <div className="transaction-grid">
                {filteredTransactions.map((transaction) => (
                    <div key={transaction._id} className="transaction-item">
                        <div className="transaction-kind">{transaction.kind}</div>
                        <div className="transaction-details">
                            <div>{transaction.date}</div>
                            <div>{transaction.type === 'income' ? '+' : '-'}{transaction.amount} 元</div>
                            <div>{transaction.description || '無描述'}</div>
                        </div>
                        <button className='btnDel' onClick={() => handleDeleteTransaction(transaction._id)}>刪除</button>
                    </div>
                ))}
            </div>
                {/* 顯示該天的總金額 */}
                <h3>您總共賺到：{incomeTotal}元</h3>
                <h3>您總共花費：{expenseTotal}元</h3>
                <h1>淨值   ：{netTotal}</h1>

                {/* 範圍查詢 */}
                {/* <label htmlFor="queryRange">Select Range:</label>
                <select id="queryRange" value={queryRange} onChange={(e) => setQueryRange(e.target.value)}>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                </select> */}

                {/* <button className="btn btn-danger" onClick={() => {
                    const { incomeTotal, expenseTotal } = calculateTotalsForRange(transactions, queryRange);
                    console.log(`Income: ${incomeTotal}, Expense: ${expenseTotal}`);
                }}>
                    Query Transactions
                </button> */}
            </div>
        </div >
    );
}

export default Home;
