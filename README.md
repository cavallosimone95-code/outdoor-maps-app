# Outdoor Maps Application

This is a basic outdoor maps application built with React and TypeScript. The application allows users to view outdoor maps, navigate through points of interest (POIs), and interact with the map.

## Features

- Interactive map view using a mapping library.
- Sidebar for navigation and filtering POIs.
- List of points of interest displayed on the map.
- User location retrieval using the Geolocation API.

## Project Structure

```
outdoor-maps-app
├── src
│   ├── app.ts          # Entry point of the application
│   ├── components      # Contains React components
│   │   ├── MapView.tsx # Displays the outdoor map
│   │   ├── Sidebar.tsx  # Navigation and options for users
│   │   └── POIList.tsx  # Displays list of points of interest
│   ├── services        # Contains services for fetching data
│   │   └── mapService.ts # Functions for fetching map data
│   ├── hooks           # Custom hooks
│   │   └── useLocation.ts # Retrieves user's current location
│   ├── styles          # CSS styles for the application
│   │   └── main.css    # Main stylesheet
│   └── types           # TypeScript interfaces
│       └── index.ts    # Type definitions
├── public
│   └── index.html      # Main HTML file
├── package.json        # npm configuration
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd outdoor-maps-app
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Start the application:
   ```
   npm start
   ```

## Usage

- Open your browser and navigate to `http://localhost:3000` to view the application.
- Use the sidebar to filter and navigate through different points of interest on the map.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License.