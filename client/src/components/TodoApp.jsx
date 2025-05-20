import React, { useState, useEffect } from 'react';
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

export default function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const response = await fetch(`${API_URL}/todos`);
        if (!response.ok) throw new Error('Nie udało się pobrać zadań');
        const data = await response.json();
        setTodos(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTodos();
  }, []);

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      const response = await fetch(`${API_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newTodo.trim() }),
      });
      if (!response.ok) throw new Error('Nie udało się dodać zadania');
      const created = await response.json();
      setTodos(prev => [...prev, created]);
      setNewTodo('');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleTodo = async id => {
    const todo = todos.find(t => t.id === id);
    try {
      const response = await fetch(`${API_URL}/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      if (!response.ok) throw new Error('Nie udało się zaktualizować zadania');
      setTodos(prev =>
        prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTodo = async id => {
    try {
      const response = await fetch(`${API_URL}/todos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Nie udało się usunąć zadania');
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Lista zadań
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" mb={3}>
        <TextField
          fullWidth
          placeholder="Dodaj nowe zadanie..."
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          variant="outlined"
        />
        <Button
          variant="contained"
          sx={{ ml: 2 }}
          onClick={addTodo}
        >
          Dodaj
        </Button>
      </Box>

      <List>
        {todos.length === 0 ? (
          <Typography color="text.secondary" align="center">
            Brak zadań na liście
          </Typography>
        ) : (
          todos.map(todo => (
            <ListItem
              key={todo.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => deleteTodo(todo.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
              </ListItemIcon>
              <ListItemText
                primary={todo.text}
                sx={{ textDecoration: todo.completed ? 'line-through' : 'none', color: todo.completed ? 'text.secondary' : 'text.primary' }}
              />
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
