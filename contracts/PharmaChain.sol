// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PharmaChain {
    
    // ==========================================
    // 1. ROLES & EVENTS
    // ==========================================
    
    address public admin;
    mapping(address => bool) public manufacturers;
    mapping(address => bool) public distributors;

    event ManufacturerUpdated(address indexed account, bool status);
    event DistributorUpdated(address indexed account, bool status);
    event BatchMinted(string indexed batchId, string medicineName, address indexed manufacturer, uint256 expiryDate);
    event TransitLogged(string indexed batchId, string location, int256 temperature, address indexed distributor);
    event BatchCompromised(string indexed batchId, string reason);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyManufacturer() {
        require(manufacturers[msg.sender], "Only authorized manufacturers can do this");
        _;
    }

    modifier onlyDistributor() {
        require(distributors[msg.sender], "Only authorized distributors can do this");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setManufacturer(address _manufacturer, bool _status) external onlyAdmin {
        manufacturers[_manufacturer] = _status;
        emit ManufacturerUpdated(_manufacturer, _status);
    }

    function setDistributor(address _distributor, bool _status) external onlyAdmin {
        distributors[_distributor] = _status;
        emit DistributorUpdated(_distributor, _status);
    }

    // ==========================================
    // 2. DATA STRUCTURES
    // ==========================================

    struct TransitRecord {
        string location;
        int256 temperature;
        string imageCID;    // IPFS hash for thermometer photo
        uint256 timestamp;
        address loggedBy;   // Distributor wallet address
    }

    struct MedicineBatch {
        string batchId;
        string medicineName;
        address manufacturer;
        uint256 expiryDate;     // Unix timestamp
        int256 minTemp;         // Minimum safe temperature
        int256 maxTemp;         // Maximum safe temperature
        uint256 minCheckpoints; // Required minimum distributor verifications
        bool isCompromised;     // True if breached or expired
        TransitRecord[] history;
    }

    mapping(string => MedicineBatch) private batches;

    // ==========================================
    // 3. CORE FUNCTIONS
    // ==========================================

    function mintBatch(
        string memory _batchId, 
        string memory _medicineName, 
        uint256 _expiryDate, 
        int256 _minTemp, 
        int256 _maxTemp,
        uint256 _minCheckpoints
    ) external onlyManufacturer {
        require(bytes(_batchId).length > 0, "Batch ID cannot be empty");
        require(batches[_batchId].manufacturer == address(0), "Batch ID already exists");
        require(_expiryDate > block.timestamp, "Expiry date must be in future");
        require(_minTemp <= _maxTemp, "Min temp cannot exceed max temp");
        require(_minCheckpoints > 0, "Min checkpoints must be at least 1");

        MedicineBatch storage newBatch = batches[_batchId];
        newBatch.batchId = _batchId;
        newBatch.medicineName = _medicineName;
        newBatch.manufacturer = msg.sender;
        newBatch.expiryDate = _expiryDate;
        newBatch.minTemp = _minTemp;
        newBatch.maxTemp = _maxTemp;
        newBatch.minCheckpoints = _minCheckpoints;
        newBatch.isCompromised = false;

        emit BatchMinted(_batchId, _medicineName, msg.sender, _expiryDate);
    }

    function updateTransit(
        string memory _batchId, 
        string memory _location, 
        int256 _currentTemp, 
        string memory _imageCID
    ) external onlyDistributor {
        require(batches[_batchId].manufacturer != address(0), "Batch does not exist");

        MedicineBatch storage batch = batches[_batchId];

        // Temperature breach check
        if (_currentTemp < batch.minTemp || _currentTemp > batch.maxTemp) {
            batch.isCompromised = true;
            emit BatchCompromised(_batchId, "Temperature breach");
        }

        // Expiry check
        if (block.timestamp > batch.expiryDate) {
            batch.isCompromised = true;
            emit BatchCompromised(_batchId, "Expired batch");
        }

        batch.history.push(TransitRecord({
            location: _location,
            temperature: _currentTemp,
            imageCID: _imageCID,
            timestamp: block.timestamp,
            loggedBy: msg.sender
        }));

        emit TransitLogged(_batchId, _location, _currentTemp, msg.sender);
    }

    // ==========================================
    // 4. CUSTOMER VERIFICATION
    // ==========================================

    function getBatchDetails(string memory _batchId) external view returns (
        string memory medicineName,
        address manufacturer,
        uint256 expiryDate,
        int256 minTemp,
        int256 maxTemp,
        uint256 minCheckpoints,
        uint256 checkpointCount,
        bool isCompromised
    ) {
        require(batches[_batchId].manufacturer != address(0), "Batch does not exist");
        MedicineBatch storage batch = batches[_batchId];
        
        bool compromised = batch.isCompromised || (block.timestamp > batch.expiryDate);

        return (
            batch.medicineName, 
            batch.manufacturer, 
            batch.expiryDate,
            batch.minTemp,
            batch.maxTemp,
            batch.minCheckpoints,
            batch.history.length,
            compromised
        );
    }

    function getBatchHistory(string memory _batchId) external view returns (TransitRecord[] memory) {
        require(batches[_batchId].manufacturer != address(0), "Batch does not exist");
        return batches[_batchId].history;
    }
}
