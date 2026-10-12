// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title LandRegistry
 * @dev Smart contract for decentralized land registration on blockchain.
 *      Stores land records immutably, supports ownership transfers,
 *      and provides verification of registration status.
 */
contract LandRegistry {

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    struct LandRecord {
        string  landId;
        string  surveyNumber;
        string  location;
        uint256 area;
        string  ownerName;
        string  ownerId;
        string  status;          // "Registered" or "Flagged for Fraud"
        uint256 registeredAt;    // block.timestamp
        bool    exists;
    }

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────

    address public admin;
    uint256 public totalRegistered;

    mapping(string => LandRecord)  private lands;
    string[]                       private allLandIds;
    mapping(string => string[])    private transferHistory;   // landId => [owner1, owner2, ...]

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event LandRegistered(
        string  landId,
        string  ownerName,
        string  status,
        uint256 timestamp
    );

    event OwnershipTransferred(
        string  landId,
        string  previousOwner,
        string  newOwner,
        uint256 timestamp
    );

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Core Functions
    // ──────────────────────────────────────────────

    /**
     * @dev Register a new land parcel on the blockchain.
     * @param _landId       Unique identifier for the land
     * @param _surveyNumber Government survey number
     * @param _location     Physical location / city
     * @param _area         Area in square feet
     * @param _ownerName    Current owner's full name
     * @param _ownerId      Current owner's government ID
     * @param _status       ML-derived status ("Registered" or "Flagged for Fraud")
     */
    function registerLand(
        string memory _landId,
        string memory _surveyNumber,
        string memory _location,
        uint256 _area,
        string memory _ownerName,
        string memory _ownerId,
        string memory _status
    ) public onlyAdmin returns (bool) {
        require(!lands[_landId].exists, "Land already registered on blockchain");

        lands[_landId] = LandRecord({
            landId:       _landId,
            surveyNumber: _surveyNumber,
            location:     _location,
            area:         _area,
            ownerName:    _ownerName,
            ownerId:      _ownerId,
            status:       _status,
            registeredAt: block.timestamp,
            exists:       true
        });

        allLandIds.push(_landId);
        transferHistory[_landId].push(_ownerName);
        totalRegistered++;

        emit LandRegistered(_landId, _ownerName, _status, block.timestamp);
        return true;
    }

    /**
     * @dev Transfer ownership of a registered land parcel.
     *      Flagged lands cannot be transferred.
     */
    function transferOwnership(
        string memory _landId,
        string memory _newOwnerName,
        string memory _newOwnerId
    ) public onlyAdmin returns (bool) {
        require(lands[_landId].exists, "Land not found");
        require(
            keccak256(bytes(lands[_landId].status)) == keccak256(bytes("Registered")),
            "Cannot transfer ownership of flagged land"
        );

        string memory previousOwner = lands[_landId].ownerName;

        lands[_landId].ownerName = _newOwnerName;
        lands[_landId].ownerId   = _newOwnerId;

        transferHistory[_landId].push(_newOwnerName);

        emit OwnershipTransferred(_landId, previousOwner, _newOwnerName, block.timestamp);
        return true;
    }

    // ──────────────────────────────────────────────
    //  Query Functions
    // ──────────────────────────────────────────────

    /**
     * @dev Retrieve full details of a registered land parcel.
     */
    function getLand(string memory _landId) public view returns (
        string memory landId,
        string memory surveyNumber,
        string memory location,
        uint256 area,
        string memory ownerName,
        string memory ownerId,
        string memory status,
        uint256 registeredAt
    ) {
        require(lands[_landId].exists, "Land not found");
        LandRecord memory l = lands[_landId];
        return (
            l.landId,
            l.surveyNumber,
            l.location,
            l.area,
            l.ownerName,
            l.ownerId,
            l.status,
            l.registeredAt
        );
    }

    /**
     * @dev Quick verification — check if a land exists and its status.
     */
    function verifyLand(string memory _landId) public view returns (
        bool exists,
        string memory status
    ) {
        if (lands[_landId].exists) {
            return (true, lands[_landId].status);
        }
        return (false, "");
    }

    /**
     * @dev Get the chain of all owners for a land parcel.
     */
    function getTransferHistory(string memory _landId) public view returns (string[] memory) {
        return transferHistory[_landId];
    }

    /**
     * @dev Total number of registered land parcels.
     */
    function getTotalLands() public view returns (uint256) {
        return totalRegistered;
    }

    /**
     * @dev Get land ID by its index (for iteration).
     */
    function getLandIdAtIndex(uint256 _index) public view returns (string memory) {
        require(_index < allLandIds.length, "Index out of bounds");
        return allLandIds[_index];
    }
}
