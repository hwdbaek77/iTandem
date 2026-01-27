API & Backend - Max

Firestore Database with MongoDB and schema for storing each parking spot and info about it
Schema for each user and personal data about them
Spots can be temporarily linked to a user with a permanent history of who has had possession of a spot

RESTful API for communicating with client apps to serve data
All computations and fetching data from Didax school api are done automatically on a backend server
Backend server hosted using firebase
Each user has an API key with their own permissions
Admin panel hosted on server for management as a web app
Scheduler on server for managing computations (such as tandem and carpool compatibility calculations, requests to rent spots, etc with priority using a priority queue)
Manage billing with stripe
Server backend logic uses SQL data about spots and users upon request, to calculate compatibility for carpool/tandem, renting, calling external apis such as didax, authentication, etc.

Design & UI - Lauren

Tandem - Nathan
Chat emotes
No custom chats
An algorithm to track spamming
Move your car!
Leaving soon!
What tandem partners are most compatible with each other
An algorithm to compare compatibility by schedule
When they come and when they leave
extracurricular activities
Going off for lunch
Seniors should be paired with other seniors
Juniors can be paired with juniors + sophomores
Sophomores can be paired with sophomores + juniors
Arrival time



Carpool - Daniel
Factors for choosing carpools (in order by weight)
Location
Class schedule
Extracurricular commitments
Give priority to seniors w/ carpools or just seniors in general
Miscellaneous factors
Fetch average gas prices in the area from license plate using public vehicle api and then get combined city/highway to calculate approximate gas price
Chat for communicating with partner
Have a bio section for music, etc.

Parking Spot Rental - Daniel
Availability 
Cancellation day before: full refund
Cancellation day of: renter gets fine
Spot ownership and renting documented with blockchain
Report system
If a student finds a spot they rented blocked, automatically reassign them to an open spot, and then pay the open spot owner with the original spot payment
If a student other than the original renter blocks the spot, fine that student directly and ban their license plate until they pay
Take photo for review using web3 photos for verification
Renting system
Spots that are available are highlighted in green, which they can do and they get a confirmation
Spots get more expensive by distance
Market rate can be fine-tuned