import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemIcon,
  Checkbox,
  ListItemText,
  IconButton,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = 'http://localhost:5000/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/todos" /> : <Navigate to="/login" />} />
        <Route path="/login" element={token ? <Navigate to="/todos" /> : <Login setToken={setToken} />} />
        <Route path="/register" element={token ? <Navigate to="/todos" /> : <Register />} />
        <Route path="/todos" element={token ? <TodoApp token={token} handleLogout={handleLogout} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

function Login({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Logowanie nie powiodło się');
      const { token } = await res.json();
      localStorage.setItem('token', token);
      setToken(token);
      navigate('/todos');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Typography variant="h5" gutterBottom>Logowanie</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField fullWidth label="Email" value={email} onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} />
      <TextField fullWidth type="password" label="Hasło" value={password} onChange={e => setPassword(e.target.value)} sx={{ mb: 2 }} />
      <Button variant="contained" fullWidth onClick={handleSubmit} disabled={loading}>
        {loading ? <CircularProgress size={24} /> : 'Zaloguj'}
      </Button>
      <Box textAlign="center" mt={2}>
        <Button onClick={() => navigate('/register')}>Rejestracja</Button>
      </Box>
    </Container>
  );
}

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Rejestracja nie powiodła się');
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Typography variant="h5" gutterBottom>Rejestracja</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Konto utworzone! Przekierowanie...</Alert>}
      <TextField fullWidth label="Email" value={email} onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} />
      <TextField fullWidth type="password" label="Hasło" value={password} onChange={e => setPassword(e.target.value)} sx={{ mb: 2 }} />
      <Button variant="contained" fullWidth onClick={handleSubmit} disabled={loading || success}>
        {loading ? <CircularProgress size={24} /> : 'Zarejestruj'}
      </Button>
    </Container>
  );
}

function TodoApp({ token, handleLogout }) {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/todos`, { headers });
      if (!res.ok) throw new Error('Nie udało się pobrać zadań');
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) return fetchTodos();
    setLoading(true);
    try {
      // VULNERABLE endpoint usage
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(search)}`, { headers });
      if (!res.ok) throw new Error('Wyszukiwanie nie powiodło się');
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      const res = await fetch(`${API_URL}/todos`, { method: 'POST', headers, body: JSON.stringify({ text: newTodo.trim() }) });
      if (!res.ok) throw new Error('Nie udało się dodać zadania');
      const created = await res.json();
      setTodos(prev => [...prev, created]);
      setNewTodo('');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleTodo = async id => {
    const todo = todos.find(t => t.id === id);
    try {
      const res = await fetch(`${API_URL}/todos/${id}`, { method: 'PUT', headers, body: JSON.stringify({ completed: !todo.completed }) });
      if (!res.ok) throw new Error('Aktualizacja nie powiodła się');
      setTodos(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTodo = async id => {
    try {
      const res = await fetch(`${API_URL}/todos/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Usuwanie nie powiodło się');
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <CircularProgress />
    </Box>
  );

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Lista zadań</Typography>
        <Button onClick={handleLogout}>Wyloguj</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Search bar using vulnerable endpoint */}
      <Box display="flex" mb={3}>
        <TextField
          fullWidth
          placeholder="Szukaj..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outlined" sx={{ ml: 2 }} onClick={handleSearch}>
          Szukaj
        </Button>
      </Box>

      <Box display="flex" mb={3}>
        <TextField
          fullWidth
          placeholder="Dodaj nowe zadanie..."
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
        />
        <Button variant="contained" sx={{ ml: 2 }} onClick={addTodo}>Dodaj</Button>
      </Box>

      <List>
        {todos.length === 0 ? (
          <Typography color="text.secondary" align="center">Brak zadań</Typography>
        ) : (
          todos.map(todo => (
            <ListItem
              key={todo.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => deleteTodo(todo.id)}><DeleteIcon /></IconButton>
              }
            >
              <ListItemIcon>
                <Checkbox checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
              </ListItemIcon>
              <ListItemText primary={todo.text} sx={{ textDecoration: todo.completed ? 'line-through' : 'none' }} />
            </ListItem>
          ))
        )}
      </List>

      {todos.length > 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          Ukończone: {todos.filter(t => t.completed).length} z {todos.length}
        </Typography>
      )}
    </Container>
  );
}
