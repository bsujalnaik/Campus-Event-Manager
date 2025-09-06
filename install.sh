#!/bin/bash

echo "Campus Event Management System - Installation Script"
echo "=================================================="
echo

echo "Installing Node.js dependencies..."
npm install

echo
echo "Initializing database with sample data..."
npm run init-db

echo
echo "Installation complete!"
echo
echo "To start the server, run: npm start"
echo
echo "Then open:"
echo "- Admin Portal: http://localhost:3000/admin"
echo "- Mobile App: http://localhost:3000/mobile"
echo
