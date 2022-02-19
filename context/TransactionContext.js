import React, { createContext, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { contractABI, contractAddress } from '../lib/constants'
import { client } from '../lib/sanityClient'
import { useRouter } from 'next/router'

export const TransactionContext = createContext()

let eth

if (typeof window !== 'undefined') {
    eth = window.ethereum
}

const getEthereumContract = () => {
    const provider = new ethers.providers.Web3Provider(eth)
    const signer = provider.getSigner()
    const transactionContract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
    )

    return transactionContract
}

export const TransactionProvider = ({children}) => {
    const [currentAccount, setCurrentAccount] = useState(null)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        addressTo: '',
        amount: ''
    })

    const router = useRouter()

    useEffect(() => {
        checkIfWalletIsConnected()
    }, [])

    //create profile in Sanity

    useEffect(() => {
        
        if (!currentAccount) return
        ;(async() => {
            
            const userDoc = {
                _type: 'users',
                _id: currentAccount,
                userName: 'Unnamed',
                address: currentAccount
            }

            await client.createIfNotExists(userDoc)
            
        })()

    }, [currentAccount])

    const connectWallet = async (metamask = eth) => {
        try {
            if (!metamask) return alert('Please install metamask')
            const accounts = await metamask.request({method: 'eth_requestAccounts'})

            if (accounts.length) {
                setCurrentAccount(accounts[0])
            }
        } catch (error) {
            console.log(error)
            throw new Error('No ethereum object')
        }
    }

    const checkIfWalletIsConnected = async (metamask = eth) => {
        try {
            if (!metamask) return alert('Please install metamask')
            const accounts = await metamask.request({method: 'eth_accounts'})

            if (accounts.length) {
                setCurrentAccount(accounts[0])
                console.log('wallet is already connected')
            }
        } catch (error) {
            console.log(error)
            throw new Error('No ethereum object')
        }
    }

    const sendTransaction = async (
        metamask = eth,
        connectedAccount = currentAccount
    ) => {
        try {

            if (!metamask) return alert('Please install metamask')
            const { addressTo, amount } = formData

            //console.log(ethers.utils.parseEther(amount), ethers.utils.parseEther(amount)._hex)

            const transactionContract = getEthereumContract ()

            const parsedAmount = ethers.utils.parseEther(amount)

            await metamask.request({
                method: 'eth_sendTransaction',
                params: [
                    {
                        from: connectedAccount,
                        to: addressTo,
                        gas: '0x7EF40', //520.000 Gwei
                        value: parsedAmount._hex,
                    }
                ]
            })

            const transactionHash = await transactionContract.publicTransaction(
                addressTo,
                parsedAmount,
                `Transferring ETH ${parsedAmount} to ${addressTo}`,
                `TRANSFER`
            )

            setLoading(true)

            await transactionHash.wait()

            await saveTransaction(
                transactionHash.hash,
                amount,
                connectedAccount,
                addressTo
            )

            setLoading(false)

        } catch (error) {
            console.log(error)
        }

    }

    const handleChange = (e, name) => {
        setFormData(prevState => ({ ...prevState, [name]: e.target.value})) //[name] => dinamic key (?)
    }

    const saveTransaction = async (
        txHash,
        amount,
        fromAddress = currentAccount,
        toAddress
    ) => {
        const txDoc = {
            _type: 'transactions',
            _id: txHash,
            fromAddress: fromAddress,
            toAddress: toAddress,
            timestamp: new Date(Date.now()).toISOString(),
            txHash: txHash,
            amount: parseFloat(amount)
        }

        await client.createIfNotExists(txDoc)

        await client
            .patch(currentAccount)
            .setIfMissing({ transactions: [] })
            .insert('after', 'transactions[-1]', [
                {
                    _key: txHash,
                    _ref: txHash,
                    _type: 'reference'
                }
            ])
            .commit()
    }

        useEffect(() => {
            if (loading) {
                router.push(`/?loading=${currentAccount}`)
            } else {
                router.push('/')
            }
        }, [loading])
 
    return (
        <TransactionContext.Provider 
            value={{
                currentAccount, 
                connectWallet,
                sendTransaction,
                handleChange,
                formData,
                loading
            }}
        >
            {children}
        </TransactionContext.Provider>
    )

}