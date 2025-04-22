import { Injectable, inject } from '@angular/core';
import { Timestamp, query, orderBy, where, addDoc, deleteDoc, getDoc, getDocs, setDoc, updateDoc, Firestore, doc, collection, collectionData, CollectionReference } from '@angular/fire/firestore';
import { User, Auth, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "@angular/fire/auth";
import { Observable, firstValueFrom,map,BehaviorSubject, combineLatest } from 'rxjs';
import { Router } from '@angular/router';
import { MqttService } from './mqtt.service';


export interface Account {
  ownedPlants: string[];
  email: string;
}

export interface Plant {
  id: string;
  name: string;
  minimumMoisture: number;
  waterVolume: number;
  waterLog: Timestamp[];
  moistureLevel: number;
  lightLog: number[];
}

@Injectable({
  providedIn: 'root',
})
export class houseplantService {
  firestore: Firestore = inject(Firestore);
  router: Router = inject(Router)
  auth: Auth = getAuth();
  user: User | null = null;
  currentAccount: Account | null = null;
  plantCollection: CollectionReference;
  public plants$: Observable<Plant[]>; 
  public ownedPlantsData: Plant[] = [];
  accountCollection: CollectionReference;
  public accounts$: Observable<Account[]>;
  private mqttService: MqttService = inject(MqttService); // Inject the MqttService
  
  constructor() {
    // Fetch all accounts from Firestore
    this.accountCollection = collection(this.firestore, 'Accounts');
    const accountConverter = {
      toFirestore: (account: Account) => account,
      fromFirestore: (snapshot: any) => {
        const data = snapshot.data();
        return {
          ownedPlants: data.ownedPlants || [],
          email: data.email,
        } as Account;
      },
    };

    // Create a proper query
    const accountsQuery = query(collection(this.firestore, 'Accounts').withConverter(accountConverter));
    this.accounts$ = collectionData<Account>(accountsQuery);

    // Fetch all plants from Firestore
    this.plantCollection = collection(this.firestore, 'Plants');
    const plantConverter = {
      toFirestore: (plant: Plant) => plant,
      fromFirestore: (snapshot: any) => {
        const data = snapshot.data();
        return {
          id: data.id,
          name: data.name,
          minimumMoisture: data.minimumMoisture,
          waterVolume: data.waterVolume,
          waterLog: data.waterLog,
          lightLog: data.lightLog,
        } as Plant;
      },
    };

    // Create a proper query for plants
    const plantsQuery = query(collection(this.firestore, 'Plants').withConverter(plantConverter));
    this.plants$ = collectionData<Plant>(plantsQuery);
 

    // Listen for auth state changes and set the user property
    onAuthStateChanged(this.auth, (currentUser) => {
      this.user = currentUser;
      console.log('Auth state changed, user is now:', this.user);
      if (this.user && this.user.email) {
        // Fetch the current account based on the logged-in user
        this.fetchAccount(this.user.email).then((account) => {
          this.currentAccount = account;  
          // Fetch plants for the current account
          this.fetchAccountPlants().then((plants) => {
            this.ownedPlantsData = plants;
            console.log('Owned plants data:', this.ownedPlantsData);
          });
        });
      } else {
        this.currentAccount = null;
      }
    });

    // subscribe to the plant topics for the current account's plants
    this.subscribeToPlantData();

    // Listen for incoming messages
    this.mqttService.messages$.subscribe((message) => {
      if (!message) return; // Ignore null messages
      console.log('Received MQTT message:', message);
      this.handleMqttMessage(message);
    });

    // Monitor + Publish instructions to maintain plant conditions every n milliseconds
    setInterval(() => this.monitorPlantConditions(), 3000);
  }  
  
  async addPlant(newPlant: Partial<Plant>): Promise<string> {
    try {
      const plantDocRef = doc(this.plantCollection);
      const id = plantDocRef.id; // Get the generated ID
  
      // Add the plant to Firestore, including the generated ID
      await setDoc(plantDocRef, {
        ...newPlant,
        id,
      });
  
      console.log('Plant successfully added with ID:', id);
  
      // update the owner's 'ownedPlants' field in their account document
      if (this.currentAccount) {  
        const accountsQuery = query(
          collection(this.firestore, 'Accounts'),
          where('email', '==', this.currentAccount.email)
        );
      
        const querySnapshot = await getDocs(accountsQuery);
      
        if (querySnapshot.empty) {
          throw new Error(`No account found with email: ${this.currentAccount.email}`);
        }
      
        const accountDocRef = querySnapshot.docs[0].ref;
      
        // Update the 'ownedPlants' array by adding the new plant ID
        await updateDoc(accountDocRef, {
          ownedPlants: [...this.currentAccount.ownedPlants, id],
        });
      
        console.log("Owner's 'ownedPlants' updated successfully");

        // Update the local `currentAccount` to reflect the change
        this.currentAccount = {
          ...this.currentAccount,
          ownedPlants: [...this.currentAccount.ownedPlants, id],
        };

        console.log('Local currentAccount updated successfully');
      }
      return id;
    } catch (error) {
      console.error('Error adding plant:', error);
    }
    return "Failed to add plant";
  }
  

  async updatePlant(plantId: string, updates: Partial<Plant>): Promise<void> {
    try {
      // Reference the specific plant document by its ID
      const plantDocRef = doc(this.firestore, 'Plants', plantId);
  
      // Check if the plant document exists
      const plantSnap = await getDoc(plantDocRef);
      if (!plantSnap.exists()) {
        throw new Error(`Plant with ID ${plantId} does not exist`);
      }
  
      // Update the plant document with the provided updates
      await updateDoc(plantDocRef, updates);
      console.log(`Plant with ID ${plantId} updated successfully.`);
    } catch (error) {
      console.error('Error updating plant:', error);
      throw error;
    }
  }

  async deletePlant(plantId: string): Promise<void> {
    try {
      if (!this.currentAccount) {
        throw new Error('No current account is logged in');
      }
  
      // Delete the plant from the "Plants" collection
      const plantDocRef = doc(this.firestore, 'Plants', plantId);
      await deleteDoc(plantDocRef);
      console.log(`Plant with ID ${plantId} deleted successfully.`);
  
      // Query the "Accounts" collection to find the current user's document
      const accountsQuery = query(
        collection(this.firestore, 'Accounts'),
        where('email', '==', this.currentAccount.email)
      );
      const querySnapshot = await getDocs(accountsQuery);

      if (querySnapshot.empty) {
        throw new Error(`No account found with email: ${this.currentAccount.email}`);
      }
      const accountDocRef = querySnapshot.docs[0].ref;

      // Remove the plant's ID from the owner's "ownedPlants" array
      const updatedOwnedPlants = this.currentAccount.ownedPlants.filter(id => id !== plantId);
      await updateDoc(accountDocRef, { ownedPlants: updatedOwnedPlants });
      console.log(`Owner's ownedPlants updated successfully after deleting plant ${plantId}`);

      // Update the local `currentAccount` to reflect the deletion
      this.currentAccount = {
        ...this.currentAccount,
        ownedPlants: updatedOwnedPlants,
      };
      console.log('Local currentAccount updated successfully');
    } catch (error) {
      console.error('Error deleting plant:', error);
      throw error;
    }
  }

  async fetchAccountPlants(): Promise<Plant[]> {
    try {
      if (!this.currentAccount) {
        throw new Error('No current account is logged in');
      }
      
      const ownedPlantIds = this.currentAccount.ownedPlants;
      
      if (ownedPlantIds.length === 0) {
        return [];
      }
      
      // Modified query to use individual document references
      const plants: Plant[] = [];
      for (const plantId of ownedPlantIds) {
        const plantDoc = await getDoc(doc(this.firestore, 'Plants', plantId));
        if (plantDoc.exists()) {
          plants.push({ id: plantDoc.id, ...plantDoc.data() } as Plant);
        }
      }
      return plants;
    } catch (error) {
      console.error('Error fetching account plants:', error);
      throw error;
    }
  }

  subscribeToPlantData(): void {
    // subscribes to the MQTT topic for all plants owned by the current account
    for (let i = 0; i < this.ownedPlantsData.length; i++) {
      const plant = this.ownedPlantsData[i];
      this.mqttService.subscribe(`cs326/plantMonitor/${plant.name}/out`);
    }
  }

  private handleMqttMessage(message: string) {
    // responsible for handling incomming MQTT messages from broker
    try {
      if (message.startsWith('')) {
        
      } else {
        console.log('Received unrecognized MQTT message:', message);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }

  private async monitorPlantConditions(): Promise<void> {
    try {
      if (!this.currentAccount) {
        console.warn('No logged-in user, skipping plant monitoring.');
        return;
      }
  
      // Fetch latest plant data
      const plants = await this.fetchAccountPlants();
  
      console.log('Plants to monitor:', plants);
      for (const plant of plants) {
        if (plant.moistureLevel !== null && plant.moistureLevel < plant.minimumMoisture) {
            console.log(`${plant.name} needs water! Sending MQTT command.`);
            // Publish MQTT command to water the plant
            this.waterPlant(plant.id);
            
        }
      }
    } catch (error) {
      console.error('Error monitoring plant conditions:', error);
    }
  }

  public async waterPlant(id: string): Promise<void> {
    // finds the plant's water volume from the plants array
    const plant = this.ownedPlantsData.find(p => p.id === id);

    if (!plant) {
      console.error(`Plant with ID ${id} not found`);
      return;
    }

    // Publish the command to the MQTT broker to water the plant
    this.mqttService.publish(`cs326/plantMonitor/${plant.name}/in`, `pump_on_${plant.waterVolume}`);
    console.log(`Published command to water ${plant.name} with volume ${plant.waterVolume}`);
  }

  public async fetchPlantByID(id: string): Promise<Plant | null> {
    try {
      const plantDocRef = doc(this.firestore, 'Plants', id);
      const plantDoc = await getDoc(plantDocRef);
      if (plantDoc.exists()) {
        return { id: plantDoc.id, ...plantDoc.data() } as Plant;
      } else {
        console.error(`No plant found with ID ${id}`);
        return null;
      }
    }
    catch (error) {
      console.error('Error fetching plant:', error);
      return null;
    }
  }

  //Creates the user for authentication, then calls createAccount to update the database
  async createUser(email: string, password: string, newAccount: Account): Promise<void> {
    console.log('Creating user with email:', email);
    createUserWithEmailAndPassword(this.auth, email, password)
      .then((userCredential) => {
        // Signed up 
        this.user = userCredential.user;
        console.log('User successfully created:', this.user);
        this._createAccount(newAccount);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
      });
  }

  // creates the account document
  async _createAccount(account: Account): Promise<void> {
    try {
      const docRef = await addDoc(this.accountCollection, account);
      console.log('Account created with ID:', docRef.id);
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }  

  async fetchAccount(email: string): Promise<Account> {
    // Create a proper query to find account by email
    const accountsQuery = query(
      collection(this.firestore, 'Accounts'),
      where('email', '==', email)
    );

    const querySnapshot = await getDocs(accountsQuery);

    if (querySnapshot.empty) {
      throw new Error(`Account with email ${email} not found`);
    }

    // Get the first (and should be only) matching document
    const accountData = querySnapshot.docs[0].data() as Account;
    return accountData;
  }  

  async login (email: string, password: string): Promise<boolean> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      this.user = userCredential.user;
      console.log('User logged in:', this.user);
      this.currentAccount = await this.fetchAccount(email)
      return true;  // Return true on successful login
    } catch (error) {
      // Handle case where the error isn't an instance of Error
      console.log(error);
      return false;
    }
  }

  async logout(): Promise<void>{
    // Sign out from Firebase Auth
    await signOut(this.auth);
    console.log('User logged out from Firebase');

    // Clear user data
    this.user = null;
    this.currentAccount = null;
    this.ownedPlantsData = [];

    // Clear MQTT subscriptions for each plant
    if (this.ownedPlantsData) {
      for (const plant of this.ownedPlantsData) {
        this.mqttService.unsubscribe(`cs326/plantMonitor/${plant.name}/out`);
      }
    }
    
    // Navigate to home page
    await this.router.navigate(['/']);
  }
}
