const express = require('express');
const House = require('../models/house');
const Transaction = require('../models/transaction');
const SetorRW = require('../models/SetorRW');
const router = express.Router();
const { format } = require('date-fns');
const moment = require('moment-timezone');

const cors = require('cors');
const corsOptions = {
    origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'],
    methods: 'GET',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};

router.post('/process', async (req, res) => {
    try {
        let filter = {
            description: { $not: /#IPLPaguyuban/i }
        };

        let beforeDate = '';
        if (req.query.before_date) {
            beforeDate = new Date(req.query.before_date);
            filter.date = { $lte: beforeDate }; 
        }

        let feeRw = '';
        if (req.query.fee_rw) {
            feeRw = req.query.fee_rw;
        }


        let monthsArray = [];
        let monthsRWArray = [];
        let requestedMonths  = [];
        const setorRWResponses = [];
        let monthCounts = {}; 

        // await Transaction.updateMany(
        //     { $set: { setor_rw: [] } }
           
        // );
        
        // return res.status(200).json({
        //     status: 200,
        //     message: 'Reset',
           
        // });
        

        if (req.query.related_months) {
            monthsArray = req.query.related_months.split(',');
            requestedMonths = req.query.related_months.split(',');
            filter.related_months = { $in: monthsArray }
            // Tambahkan filter untuk setor_rw hanya yang statusnya 'pending'
            filter["$or"] = [
                { setor_rw: [] },  
                { setor_rw: { $exists: false } }, 
                { setor_rw: { $elemMatch: { month: { $in: monthsArray }, status: "pending", setor_rw_id: null } } }
            ];
            
        }

        //console.log("Filter yang digunakan:", filter);

        const transactions = await Transaction.find(filter)
            .populate([{
                path: 'created_by',
                select: 'email name whatsapp_number'
            }, {
                path: 'house_id',
                select: 'house_id monthly_fees'

            }])
            .sort({ created_at: -1 })
            .select({ description: 1, related_months:1, created_by:1, house_id:1,  date: 1, status:1,setor_rw:1
        });

        for (const month of requestedMonths) {
            monthCounts[month] = 0;
        }

        for (const transaction of transactions) {
            for (const month of transaction.related_months) {
                if (monthCounts[month] !== undefined) {
                    monthCounts[month] += 1;
                }
            }
        }

        monthsRWArray = Object.keys(monthCounts).map(month => ({
            month: month,
            total: monthCounts[month],
            //units: transactions.filter(t => t.related_months.includes(month)) 
        }));

        // Pastikan monthsRWArray memiliki data yang valid sebelum reduce()
        const totalUnits = Array.isArray(monthsRWArray) 
        ? monthsRWArray.reduce((sum, month) => sum + (month.total || 0), 0) 
        : 0;

        // Pastikan feeRw adalah angka yang valid
        const validFeeRw = Number(feeRw) || 0;

        // Hitung total setor RW dengan validasi tambahan
        const totalSetorRw = totalUnits * validFeeRw;


        //console.log("Jumlah transaksi ditemukan:", transactions.length);
        //console.log(monthsArray)
        if(transactions && transactions.length > 0) {
            const setorRW = new SetorRW({
                fee_setor_rw: feeRw,
                tanggal_setor_rw: beforeDate,
                related_months: monthsRWArray,
                total_setor_rw: totalSetorRw 
            });
            const savedSetorRW = await setorRW.save();
            setorRWResponses.push(savedSetorRW);
        }
       

        //Lakukan update untuk setiap house yang terkait transaksi

        if(setorRWResponses && transactions) {
            for (const transaction of transactions) {
                const house = transaction.house_id;

                if (house && Array.isArray(house.monthly_fees)){
                    for (const month of monthsArray) {
                        const feeIndex = house.monthly_fees.findIndex(fee => fee.month === month);
                        if (feeIndex !== -1) {
                            const updatedFee = house.monthly_fees[feeIndex];
        
                            // updatedFee.status_setor_rw = 'pending'; // Status setor selesai
                            // updatedFee.fee_setor_rw = ""; // Jumlah sesuai dengan transaksi
                            // updatedFee.tanggal_setor_rw = ""; // Tanggal sesuai dengan transaksi
                            // updatedFee.setor_rw_id = null; // Masukkan setor_rw_id ke dalam monthly_fees
                        
                            // await house.save();
                        
                           
                            if (updatedFee.status_setor_rw === 'pending' && updatedFee.setor_rw_id === null && updatedFee.setor_rw_id !== setorRWResponses[0]._id) {
                                updatedFee.status_setor_rw = 'done'; 
                                updatedFee.fee_setor_rw = feeRw;
                                updatedFee.tanggal_setor_rw = beforeDate; 
                                updatedFee.setor_rw_id = setorRWResponses[0]._id; 
                            
                                await house.save();
                              
                            }
                            
                        }
                    }
                } else {
                    //console.warn(`House or monthly_fees not defined for transaction: ${transaction._id}`);
                }
                
            }
        }

        for (const transaction of transactions) {
            if (Array.isArray(monthsArray)) {
                // Filter bulan yang ada di both monthsArray dan transaction.related_months
                const validMonths = transaction.related_months.filter(month => monthsArray.includes(month));
        
                transaction.setor_rw = validMonths.map(month => ({
                    month: month,
                    status: 'done',
                    date: beforeDate,
                    setor_rw_id: setorRWResponses[0]._id
                }));
        
                await transaction.save(); 
            } else {
                transaction.setor_rw = []; 
            }
        }
        
    
        return res.status(200).json({
            status: 200,
            message: 'Success',
            data: {
                setorRW: setorRWResponses,
                transactions: transactions,
            },
            total: transactions.length
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message
        });
    }
});

router.get('/units', async (req, res) => {
    const st_id = req.query.id;
    const month = req.query.month;
    let filter = {};
    
    try {
        if (st_id) {
            filter["setor_rw"] = {
                $elemMatch: {
                    month: month,
                    status: "done",
                    setor_rw_id: st_id
                    
                }
            };
        }
        
        const units = await Transaction.find(filter)
            .populate({
                path: 'house_id',
                model: 'House',
                select: 'house_id resident_name group'
            })
            .select('date transaction_id')
            .sort({ _id: 1 })
            .lean();
        
      
        const groupOrder = [
          "E1 Ganjil",
          "E1 Genap - E2 Ganjil",
          "E2 Genap - E3 Ganjil",
          "E3 Genap - E5",
          "E3A Genap - E8"
        ];

        units.sort((a, b) => {
          const indexA = groupOrder.indexOf(a.house_id.group);
          const indexB = groupOrder.indexOf(b.house_id.group);
          return indexA - indexB;
        });
          
        return res.status(200).json({
            status: 200,
            message: 'success',
            period: month,
            data: units,
            total: units.length
        });
  
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        status: 500,
        error: 'Error fetching  data'
      });
    }
});

// router.get('/', async (req, res) => {
//     try {
//         const data = await SetorRW.find();
        
//         return res.status(200).json({
//             status: 200,
//             message: 'Suscess',
//             data: data
//         });
        
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({
//             status: 500,
//             message: err.message 
//         });
//     }
// });

router.get('/', async (req, res) => {
    try {
        const setorRWData = await SetorRW.find();

        if (!setorRWData || setorRWData.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }
        
        const allUnits = await Promise.all(setorRWData.map(async (setorRW) => {
            const st_id = setorRW._id;
            const relatedMonths = setorRW.related_months;

            // Convert Mongoose document to plain object to modify
            let setorRWObj = setorRW.toObject();

            // Prepare filter for transactions based on current setorRW's related_months
            const filter = {
                setor_rw: {
                    $elemMatch: {
                        status: "done",
                        setor_rw_id: st_id,
                    },
                },
            };

            const transactions = await Transaction.find(filter)
                .populate({
                    path: 'house_id',
                    model: 'House',
                    select: 'house_id resident_name group'
                })
                .select('date transaction_id house_id')
                .sort({ _id: 1 })
                .lean();

            const groupOrder = [
                "E1 Ganjil",
                "E1 Genap - E2 Ganjil",
                "E2 Genap - E3 Ganjil",
                "E3 Genap - E5",
                "E3A Genap - E8"
            ];
    
            transactions.sort((a, b) => {
                const indexA = groupOrder.indexOf(a.house_id.group);
                const indexB = groupOrder.indexOf(b.house_id.group);
                return indexA - indexB;
            });

            // Process transactions to add to related_months
            setorRWObj.related_months = relatedMonths.map((relatedMonth) => {
                const cleanMonth = relatedMonth.toObject(); // Konversi ke plain object
            
                const month = cleanMonth.month;
            
                // Filter transactions that belong to this month
                const monthTransactions = transactions.filter(unit => 
                    unit.date.toISOString().slice(0, 7) === month
                );
            
                // Extract relevant units
                cleanMonth.units = monthTransactions.map(unit => ({
                    transaction_id: unit.transaction_id,
                    date: unit.date,
                    house_id: unit.house_id ? unit.house_id.house_id : null,
                    resident_name: unit.house_id ? unit.house_id.resident_name : null,
                    group: unit.house_id ? unit.house_id.group : null
                }));
            
                return cleanMonth; // Mengembalikan objek bersih tanpa Mongoose metadata
            });

            return setorRWObj; // Return the modified object
        }));

        return res.status(200).json({
            status: 200,
            message: 'Success',
            data: allUnits
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message 
        });
    }
});


router.get('/:id', async (req, res) => {
    const st_id = req.params.id;
    try {
        const setorRWData = await SetorRW.find({_id : st_id});

        if (!setorRWData || setorRWData.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }
        
        const allUnits = await Promise.all(setorRWData.map(async (setorRW) => {
            const st_id = setorRW._id;
            const relatedMonths = setorRW.related_months;

            // Convert Mongoose document to plain object to modify
            let setorRWObj = setorRW.toObject();

            // Prepare filter for transactions based on current setorRW's related_months
            const filter = {
                setor_rw: {
                    $elemMatch: {
                        status: "done",
                        setor_rw_id: st_id,
                    },
                },
            };

            const transactions = await Transaction.find(filter)
                .populate({
                    path: 'house_id',
                    model: 'House',
                    select: 'house_id resident_name group'
                })
                .select('date transaction_id house_id')
                .sort({ _id: 1 })
                .lean();

            const groupOrder = [
                "E1 Ganjil",
                "E1 Genap - E2 Ganjil",
                "E2 Genap - E3 Ganjil",
                "E3 Genap - E5",
                "E3A Genap - E8"
            ];
    
            transactions.sort((a, b) => {
                const indexA = groupOrder.indexOf(a.house_id.group);
                const indexB = groupOrder.indexOf(b.house_id.group);
                return indexA - indexB;
            });

            // Process transactions to add to related_months
            setorRWObj.related_months = relatedMonths.map((relatedMonth) => {
                const cleanMonth = relatedMonth.toObject(); // Konversi ke plain object
            
                const month = cleanMonth.month;
            
                // Filter transactions that belong to this month
                const monthTransactions = transactions.filter(unit => 
                    unit.date.toISOString().slice(0, 7) === month
                );
            
                // Extract relevant units
                cleanMonth.units = monthTransactions.map(unit => ({
                    transaction_id: unit.transaction_id,
                    date: unit.date,
                    house_id: unit.house_id ? unit.house_id.house_id : null,
                    resident_name: unit.house_id ? unit.house_id.resident_name : null,
                    group: unit.house_id ? unit.house_id.group : null
                }));
            
                return cleanMonth; // Mengembalikan objek bersih tanpa Mongoose metadata
            });

            return setorRWObj; // Return the modified object
        }));

        return res.status(200).json({
            status: 200,
            message: 'Success',
            data: allUnits
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message 
        });
    }
   
});






// router.get('/:id', async (req, res) => {
//     const st_id = req.params.id;
//     let filter = {};
    
//     try {
//        // console.log(st_id)

//         if (st_id) {
//             filter["monthly_fees"] = {
//                 $elemMatch: {
//                     status_setor_rw: "done",
//                     setor_rw_id: st_id
//                 }
//             };
//         }
        
//         const houses = await House.find()
//             .populate({
//                 path: 'monthly_fees.transaction_id',
//                 model: 'Transaction',
//                 select: '_id date proof_of_transfer payment_type',
//                 match: { 'setor_rw.setor_rw_id': st_id }
//             })
//             .select('house_id resident_name monthly_fees')
//             .sort({ house_id: 1 })
//             .lean();
        
//         const filteredHouses = houses
//         .map(house => ({
//             ...house,
//             monthly_fees: house.monthly_fees.filter(fee => 
//                 fee.transaction_id !== null ||
//                 fee.status_setor_rw === "done" ||
//                 fee.setor_rw_id === st_id
//             )
//         }))
//         .filter(house => house.monthly_fees.length > 0); // Hapus house jika monthly_fees kosong
        
//         const groupOrder = [
//           "E1 Ganjil",
//           "E1 Genap - E2 Ganjil",
//           "E2 Genap - E3 Ganjil",
//           "E3 Genap - E5",
//           "E3A Genap - E8"
//         ];

//         filteredHouses.sort((a, b) => {
//           const indexA = groupOrder.indexOf(a.group);
//           const indexB = groupOrder.indexOf(b.group);
//           return indexA - indexB;
//         });
          
//         return res.status(200).json({
//             status: 200,
//             message: 'success',
//             data: filteredHouses,
//             total: filteredHouses.length
//         });
  
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).json({
//         status: 500,
//         error: 'Error fetching ipl data'
//       });
//     }
// });



module.exports = router;
